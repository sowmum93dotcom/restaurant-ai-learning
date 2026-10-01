const test=require('node:test'),assert=require('node:assert/strict');
const {prepareQuote,transition,customerReceipt}=require('../api/_lib/customer-payment-contract');
const {createPaymentService}=require('../api/_lib/customer-payment-service');
const {createPaymentStore}=require('../api/_lib/customer-payment-store');
const now=()=>Date.UTC(2026,9,1);
function quote(overrides={}){return {mode:'test',recipient:'business',customerId:'customer-a',businessId:'test-business-fashion',productId:'test-product-activewear',sellerName:'Controlled Test Fashion',productName:'Controlled outfit',sellerContact:'Controlled test contact',refundTerms:'Controlled refund test only',merchantAccountId:'test-merchant-a',sellerVerified:true,disclosuresVerified:true,selection:{size:'extraLarge',colour:'blue'},quantity:2,unitMinor:4700,deliveryMinor:500,taxMinor:0,totalMinor:9900,currency:'GBP',fulfilmentMethod:'delivery',fulfilmentReference:'test-fulfilment-a',fulfilmentVerified:true,expiresAt:now()+300000,...overrides};}
function evidence(record,overrides={}){return {mode:'test',orderId:record.id,paymentId:record.paymentId,merchantAccountId:record.quote.merchantAccountId,currency:record.quote.currency,amountMinor:record.quote.totalMinor,status:'paid',refundedMinor:0,...overrides};}
test('payment quote is exact, server-derived, direct to the business and strictly test-only',()=>{
 const q=prepareQuote(quote(),now());assert.equal(q.totalMinor,9900);assert.deepEqual(q.selection,{size:'extraLarge',colour:'blue'});assert.equal(q.recipient,'business');
 for(const overrides of [{mode:'live'},{recipient:'demeos'},{sellerVerified:false},{disclosuresVerified:false},{fulfilmentVerified:false},{fulfilmentReference:''},{quantity:0},{quantity:1.5},{totalMinor:9901},{unitMinor:47.5},{deliveryMinor:-1},{currency:'gbp'},{expiresAt:now()},{merchantAccountId:''},{selection:{forged:'option'}},{refundTerms:''}])assert.equal(prepareQuote(quote(overrides),now()),null,JSON.stringify(overrides));
 const sensitive=prepareQuote(quote({cardNumber:'secret',address:'Private Address'}),now());assert.equal('cardNumber'in sensitive,false);assert.equal('address'in sensitive,false);
 assert.equal(prepareQuote(quote({expiresAt:now()+400000,selection:{colour:'blue',size:'extraLarge'}}),now()).fingerprint,q.fingerprint,'refreshing expiry and key order does not change idempotency');
 assert.notEqual(prepareQuote(quote({fulfilmentReference:'different-address-record'}),now()).fingerprint,q.fingerprint);
});
test('verified payment evidence must match the payment, seller, exact total and currency',()=>{
 const record={id:'order-a',paymentId:'payment-a',state:'pending',quote:prepareQuote(quote(),now()),refundedMinor:0};
 assert.equal(transition(record,evidence(record)).state,'paid');
 for(const overrides of [{mode:'live'},{orderId:'other-order'},{paymentId:'other-payment'},{merchantAccountId:'other-business'},{currency:'USD'},{amountMinor:9800},{status:'browser-success'},{refundedMinor:-1},{refundedMinor:10000}])assert.equal(transition(record,evidence(record,overrides)),null);
 const partial=transition(record,evidence(record,{refundedMinor:3000}));assert.equal(partial.state,'partially-refunded');
 const full=transition(partial,evidence(record,{refundedMinor:9900}));assert.equal(full.state,'refunded');assert.equal(transition(full,evidence(record,{refundedMinor:1000})).refundedMinor,9900);
 assert.equal(transition(full,evidence(record,{status:'failed'})).state,'refunded');assert.equal(transition(full,evidence(record,{status:'cancelled'})).state,'refunded');
});
test('customer receipts reveal only the customer selection and payment/refund status',()=>{
 const r={id:'order-a',paymentId:'private-provider-id',state:'pending',quote:prepareQuote(quote(),now())};
 assert.equal(customerReceipt(r,'other-customer'),null);const receipt=customerReceipt(r,'customer-a');assert.equal(receipt.paid,false);assert.equal(receipt.testMode,true);assert.equal(receipt.reference,'order-a');
 assert.equal('merchantAccountId'in receipt,false);assert.equal('customerId'in receipt,false);assert.equal('paymentId'in receipt,false);assert.equal('fulfilmentReference'in receipt,false);assert.equal('checkoutUrl'in receipt,false);
 assert.equal(customerReceipt({...r,state:'paid'},'customer-a').paid,true);
});
test('no provider means no payment calls or storage writes',async()=>{
 const service=createPaymentService({loadQuote:()=>{throw Error('must not load');},store:{reserve:()=>{throw Error('must not write');}}});
 assert.deepEqual(service.capabilities(),{configured:false,mode:'test',recipient:'business',livePayments:false});assert.equal((await service.begin('customer-a',{},'1234567890123456')).reason,'gateway-not-configured');assert.equal((await service.notification(Buffer.from('{}'),{})).reason,'gateway-not-configured');
});
test('real PostgreSQL storage and gateway-independent payment flow',async t=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
  const store=createPaymentStore(db);let currentQuote=quote(),calls=0,throwCreate=false,throwRetrieve=false,invalidSession=false,signatureValid=true,currentEvidence,eventId='event-one',eventOrder='order-a',eventPayment='payment-a';
  const provider={name:'deterministic-test-adapter',mode:'test',checkoutOrigins:['https://gateway.example'],async createCheckout(input){calls++;if(throwCreate)throw Error('timeout');assert.equal(input.recipient,'business');assert.equal(input.merchantAccountId,'test-merchant-a');assert.equal(input.amountMinor,9900);return {url:invalidSession?'https://attacker.example/checkout':'https://gateway.example/checkout',paymentId:'payment-a',mode:'test',expiresAt:now()+120000,merchantAccountId:input.merchantAccountId,amountMinor:input.amountMinor,currency:input.currency};},async verifyNotification(raw){if(!signatureValid)throw Error('bad signature');assert.ok(Buffer.isBuffer(raw));return {id:eventId,orderId:eventOrder,paymentId:eventPayment,mode:'test'};},async retrievePayment(){if(throwRetrieve)throw Error('provider down');return currentEvidence;}};
  const service=createPaymentService({provider,store,loadQuote:async()=>currentQuote,now,newId:()=> 'order-a'});
  await t.test('durable reservation precedes payment; timeout retry uses the same reference',async()=>{
   throwCreate=true;assert.equal((await service.begin('customer-a',{},'customer-click-key')).reason,'gateway-unavailable');assert.equal((await store.get('order-a')).state,'creating');throwCreate=false;const result=await service.begin('customer-a',{},'customer-click-key');assert.equal(result.ready,true);assert.equal(result.receipt.paid,false);assert.equal(result.receipt.state,'pending');assert.equal(calls,2);assert.equal((await service.begin('customer-a',{},'customer-click-key')).ready,true);assert.equal(calls,2,'double click never creates another provider session');
  });
  await t.test('changed selections conflict with the original click instead of changing the order',async()=>{
   currentQuote=quote({selection:{size:'small',colour:'blue'}});assert.equal((await service.begin('customer-a',{},'customer-click-key')).reason,'idempotency-conflict');currentQuote=quote();assert.equal(await service.receipt('other-customer','order-a'),null);assert.equal((await service.receipt('customer-a','order-a')).quantity,2);
  });
  await t.test('expired checkout does not create another payment and cannot be resumed blindly',async()=>{
   const expired=createPaymentService({provider,store,loadQuote:async()=>quote(),now:()=>now()+150000,newId:()=> 'order-a'});
   assert.equal((await expired.begin('customer-a',{},'customer-click-key')).reason,'checkout-expired');assert.equal(calls,2);
  });
  await t.test('forged notifications, browser claims and provider failures do not mark paid',async()=>{
   assert.equal((await service.notification({paid:true},{})).reason,'invalid-notification');signatureValid=false;assert.equal((await service.notification(Buffer.from('{}'),{})).reason,'invalid-notification');signatureValid=true;const record=await store.get('order-a');currentEvidence=evidence(record,{amountMinor:9800});assert.equal((await service.notification(Buffer.from('{}'),{})).reason,'payment-mismatch');throwRetrieve=true;assert.equal((await service.notification(Buffer.from('{}'),{})).reason,'gateway-unavailable');throwRetrieve=false;assert.equal((await store.get('order-a')).state,'pending');
  });
  await t.test('verified payment, duplicate events, refunds and late failures remain consistent',async()=>{
   let record=await store.get('order-a');currentEvidence=evidence(record);const both=await Promise.all([service.notification(Buffer.from('{}'),{}),service.notification(Buffer.from('{}'),{})]);assert.ok(both.every(r=>r.ready));record=await store.get('order-a');assert.equal(record.state,'paid');const version=record.version;await service.notification(Buffer.from('{}'),{});assert.equal((await store.get('order-a')).version,version);
   eventId='partial-refund';currentEvidence=evidence(record,{refundedMinor:3000});assert.equal((await service.notification(Buffer.from('{}'),{})).ready,true);assert.equal((await service.receipt('customer-a','order-a')).state,'partially-refunded');eventId='full-refund';currentEvidence=evidence(record,{refundedMinor:9900});await service.notification(Buffer.from('{}'),{});assert.equal((await service.receipt('customer-a','order-a')).state,'refunded');eventId='late-failure';currentEvidence=evidence(record,{status:'failed'});await service.notification(Buffer.from('{}'),{});assert.equal((await service.receipt('customer-a','order-a')).refundedMinor,9900);assert.equal((await service.begin('customer-a',{},'customer-click-key')).checkoutUrl,null);
  });
  await t.test('SQL enforces customer ownership and test/business separation independently',async()=>{
   const record=await store.get('order-a');await assert.rejects(()=>store.reserve({...record,id:'live-record',quote:{...record.quote,mode:'live'}},'another-key'));await assert.rejects(()=>store.reserve({...record,id:'platform-record',quote:{...record.quote,recipient:'demeos'}},'another-key'));assert.equal(await store.getOwn("customer-a' OR TRUE --",'order-a'),null);assert.equal((await db.query('SELECT count(*) AS count FROM demeos_customer_test_payment_attempts')).rows[0].count,1);
  });
  await t.test('own-customer reconciliation recovers missed gateway events without trusting the browser',async()=>{
   const record=await store.get('order-a');currentEvidence=evidence(record,{refundedMinor:9900});assert.equal((await service.reconcile('other-customer','order-a')).reason,'not-found');assert.equal((await service.reconcile('customer-a','order-a')).receipt.state,'refunded');currentEvidence=evidence(record,{paymentId:'other-payment'});assert.equal((await service.reconcile('customer-a','order-a')).reason,'payment-mismatch');
  });
  await t.test('terminal notification before creation response recovers the payment without another session',async()=>{
   const record={id:'early-order',provider:provider.name,state:'creating',quote:prepareQuote(quote(),now()),version:0,refundedMinor:0};await store.reserve(record,'early-notification-key');eventOrder='early-order';eventPayment='early-payment';eventId='early-terminal-event';currentEvidence=evidence({...record,paymentId:eventPayment});assert.equal((await service.notification(Buffer.from('{}'),{})).ready,true);assert.equal((await service.receipt('customer-a','early-order')).state,'paid');assert.equal((await store.get('early-order')).paymentId,'early-payment');eventOrder='order-a';eventPayment='payment-a';
  });
  await t.test('unsafe gateway URL or live adapter cannot produce an actionable checkout',async()=>{
   const fakeStore={...store,reserve:async()=>({id:'order-a',provider:provider.name,quote:prepareQuote(quote(),now()),state:'creating',version:0})};invalidSession=true;const isolated=createPaymentService({provider,store:fakeStore,loadQuote:async()=>quote(),now});assert.equal((await isolated.begin('customer-a',{},'customer-click-key')).reason,'invalid-gateway-session');const live=createPaymentService({provider:{...provider,mode:'live'},store,loadQuote:async()=>quote(),now});assert.equal(live.capabilities().configured,false);
  });
 }finally{await db.close();}
});
