const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../api/_lib/customer-checkout');
const {productExperienceTestContent:fixtures}=require('../api/_lib/controlled-customer-test-content');
const draft=()=>({version:1,workItemId:'test-discover-family',productId:'test-product-childrens-collection',selection:{size:'medium',colour:'blue'},quantity:2,expires:Date.now()+100000});
const details={address:'12 Controlled Test Road',city:'Conakry',country:'Guinea'};
const req=()=>({method:'POST',headers:{host:'www.demeos.io',origin:'https://www.demeos.io','x-demeos-test-mode':'controlled-preview','idempotency-key':'customer-click-key'},query:{'demeos-test':'1'},body:{draft:draft(),details}});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(v){this.body=v;return this;}});
const handler=(extra={})=>createHandler({authenticate:async()=>({trustedCustomerIdentityId:'trusted'}),repository:()=>({getOwnedBusinessIds:async()=>[]}),...extra});
test('unconnected customer checkout revalidates selection and never creates an order or payment',async()=>{
 const r=res();await handler()(req(),r);assert.equal(r.statusCode,503);assert.deepEqual(r.body,{reason:'gateway-not-configured',paymentActive:false,orderCreated:false});assert.equal(r.headers['Cache-Control'],'private, no-store');
 const invalid=req();invalid.body.draft.selection.colour='black';const out=res();await handler()(invalid,out);assert.equal(out.statusCode,409);
 const missing=req();missing.body.details={};const m=res();await handler()(missing,m);assert.equal(m.statusCode,400);
});
test('checkout denies anonymous, business-owner, cross-origin and uncontrolled requests before provider calls',async()=>{
 let calls=0;const service={capabilities(){calls++;throw Error('must not reach provider');}};
 for(const changes of [{authenticate:async()=>null},{repository:()=>({getOwnedBusinessIds:async()=>['business']})}]){const r=res();await handler({...changes,service})(req(),r);assert.ok([401,403].includes(r.statusCode));}
 for(const altered of [{...req(),query:{}},{...req(),headers:{...req().headers,'x-demeos-test-mode':undefined}},{...req(),headers:{...req().headers,origin:'https://attacker.example'}},{...req(),headers:{...req().headers,origin:undefined}}]){const r=res();await handler({service})(altered,r);assert.equal(r.statusCode,403);}assert.equal(calls,0);
 const saved=process.env.DEMEOS_CONTROLLED_TEST_CONTENT;process.env.DEMEOS_CONTROLLED_TEST_CONTENT='disabled';try{const r=res();await handler({service})(req(),r);assert.equal(r.statusCode,403);}finally{if(saved===undefined)delete process.env.DEMEOS_CONTROLLED_TEST_CONTENT;else process.env.DEMEOS_CONTROLLED_TEST_CONTENT=saved;}
});
test('checkout supplies only authenticated identity and freshly resolved server price to private quote loader',async()=>{
 let input;const service={capabilities:()=>({configured:true,mode:'test',recipient:'business',livePayments:false}),async begin(id,selection,key){input={id,selection,key};return{ready:false,reason:'gateway-unavailable'};}};
 const r=res();await handler({service})(req(),r);assert.equal(r.statusCode,503);assert.equal(input.id,'trusted');assert.equal(input.selection.preparation.state.pricing.amount,27);assert.deepEqual(input.selection.preparation.draft.selection,{size:'medium',colour:'blue'});assert.equal(input.selection.preparation.draft.quantity,2);assert.deepEqual(input.selection.details,details);
 for(const key of ['price','customerId','paid','redirectUrl']){const altered=req();altered.body[key]='forged';const r=res();await handler({service})(altered,r);assert.equal(r.statusCode,400);}
 const unavailable=()=>{const w=fixtures();w.find(b=>b.workItemId==='test-discover-family').products.find(p=>p.productId==='test-product-childrens-collection').availability='unavailable';return w;};const out=res();await handler({fixtures:unavailable,service})(req(),out);assert.equal(out.statusCode,409);
});
test('payment status always reads the authenticated customer and cannot accept browser-paid claims',async()=>{
 const service={capabilities:()=>({configured:true,mode:'test',recipient:'business',livePayments:false}),async receipt(id,reference){assert.equal(id,'trusted');return reference==='own-reference'?{reference,testMode:true,recipient:'business',state:'pending',paid:false}:null;}};
 for(const [reference,status] of [['own-reference',200],['other-reference',404],['../private',400]]){const r=res();await handler({service})({...req(),method:'GET',query:{'demeos-test':'1',reference},body:{paid:true}},r);assert.equal(r.statusCode,status);if(status===200)assert.equal(r.body.receipt.paid,false);}
 const r=res();await handler({service:{capabilities:()=>({configured:true,mode:'live',recipient:'business',livePayments:true})}})(req(),r);assert.equal(r.statusCode,503);
});
