// Gateway-independent orchestration. An unconfigured provider cannot create a payment.
'use strict';
const {randomUUID}=require('node:crypto');
const {prepareQuote,transition,customerReceipt}=require('./customer-payment-contract');
const failure=reason=>({ready:false,reason});
function createPaymentService({provider=null,store,loadQuote,now=Date.now,newId=randomUUID}={}){
 function configured(){return provider?.mode==='test'&&typeof provider.name==='string'&&provider.name.length>0&&Array.isArray(provider.checkoutOrigins)&&provider.checkoutOrigins.length>0&&['createCheckout','verifyNotification','retrievePayment'].every(k=>typeof provider[k]==='function')&&store&&['reserve','attach','get','apply','getOwn'].every(k=>typeof store[k]==='function')&&typeof loadQuote==='function';}
 async function begin(customerId,input,idempotencyKey){
  if(!configured())return failure('gateway-not-configured');
  if(typeof customerId!=='string'||!customerId||typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))return failure('invalid');
  // The loader independently authenticates the customer selection against current private records.
  const quote=prepareQuote(await loadQuote(customerId,input),now());
  if(!quote||quote.customerId!==customerId)return failure('selection-not-ready');
  const record=await store.reserve({id:newId(),provider:provider.name,quote,state:'creating',refundedMinor:0,version:0},idempotencyKey);
  if(!record||record.provider!==provider.name||record.quote.fingerprint!==quote.fingerprint)return failure('idempotency-conflict');
  if(record.state!=='creating'){
   if(record.state==='pending'&&record.checkoutExpiresAt<=now())return failure('checkout-expired');
   return {ready:true,receipt:customerReceipt(record,customerId),checkoutUrl:record.state==='pending'?record.checkoutUrl:null};
  }
  if(record.quote.expiresAt<=now())return failure('quote-expired');
  let session;try{session=await provider.createCheckout({orderId:record.id,mode:'test',recipient:'business',merchantAccountId:quote.merchantAccountId,amountMinor:quote.totalMinor,currency:quote.currency,idempotencyKey:record.id});}catch(_){return failure('gateway-unavailable');}
  let url;try{url=new URL(session?.url);}catch(_){return failure('invalid-gateway-session');}
  if(url.protocol!=='https:'||url.username||url.password||!provider.checkoutOrigins.includes(url.origin)||typeof session.paymentId!=='string'||!session.paymentId||!Number.isFinite(session.expiresAt)||session.expiresAt<=now()||session.expiresAt>record.quote.expiresAt||session.mode!=='test'||session.merchantAccountId!==quote.merchantAccountId||session.amountMinor!==quote.totalMinor||session.currency!==quote.currency)return failure('invalid-gateway-session');
  const pending=await store.attach(record,{paymentId:session.paymentId,checkoutUrl:url.href,checkoutExpiresAt:session.expiresAt,state:'pending'});
  if(!pending)return failure('retry');
  return {ready:true,checkoutUrl:pending.state==='pending'?pending.checkoutUrl:null,receipt:customerReceipt(pending,customerId)};
 }
 async function notification(rawBody,headers){
  if(!configured())return failure('gateway-not-configured');
  // No browser success parameter, parsed JSON or boolean can replace gateway signature verification.
  if(!Buffer.isBuffer(rawBody))return failure('invalid-notification');
  let event;try{event=await provider.verifyNotification(rawBody,headers);}catch(_){return failure('invalid-notification');}
  if(!event||event.mode!=='test'||['id','orderId','paymentId'].some(k=>typeof event[k]!=='string'||!event[k].trim()||event[k].length>200))return failure('invalid-notification');
  // Reconcile with the provider's current payment record, not an out-of-order event's claimed status.
  let evidence;try{evidence=await provider.retrievePayment(event.paymentId);}catch(_){return failure('gateway-unavailable');}
  if(evidence?.paymentId!==event.paymentId||evidence?.orderId!==event.orderId)return failure('payment-mismatch');
  for(let attempt=0;attempt<3;attempt++){
   let record=await store.get(event.orderId);
   if(!record||record.provider!==provider.name)return failure('payment-mismatch');
   // A verified terminal event can arrive before the session creation response.
   // Bind its payment ID only after checking every frozen quote/account field.
   if(record.state==='creating'&&!record.paymentId){
    if(evidence.status==='pending')return failure('retry');
    if(!transition({...record,paymentId:event.paymentId,state:'pending'},evidence))return failure('payment-mismatch');
    record=await store.attach(record,{paymentId:event.paymentId,checkoutUrl:null,checkoutExpiresAt:0,state:'pending'});
    if(!record)continue;
   }
   const next=transition(record,evidence);if(!next)return failure('payment-mismatch');
   const saved=await store.apply(record,next,'notification:'+event.id);
   if(saved)return {ready:true};
  }
  return failure('retry');
 }
 async function receipt(customerId,id){
  if(typeof customerId!=='string'||!customerId||typeof id!=='string'||!id||typeof store?.getOwn!=='function')return null;
  return customerReceipt(await store.getOwn(customerId,id),customerId);
 }
 async function reconcile(customerId,id){
  if(!configured())return failure('gateway-not-configured');
  const owned=await store.getOwn(customerId,id);
  if(!owned||owned.quote.customerId!==customerId||owned.provider!==provider.name||!owned.paymentId)return failure('not-found');
  let evidence;try{evidence=await provider.retrievePayment(owned.paymentId);}catch(_){return failure('gateway-unavailable');}
  for(let attempt=0;attempt<3;attempt++){
   const record=await store.getOwn(customerId,id);const next=transition(record,evidence);
   if(!next)return failure('payment-mismatch');
   const eventId='reconcile:'+owned.paymentId+':'+evidence.status+':'+evidence.refundedMinor;
   const saved=await store.apply(record,next,eventId);
   if(saved)return {ready:true,receipt:customerReceipt(saved,customerId)};
  }
  return failure('retry');
 }
 return Object.freeze({capabilities:()=>({configured:!!configured(),mode:'test',recipient:'business',livePayments:false}),begin,notification,receipt,reconcile});
}
module.exports={createPaymentService};
