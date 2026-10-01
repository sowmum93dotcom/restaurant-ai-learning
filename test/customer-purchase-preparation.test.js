const test=require('node:test'),assert=require('node:assert/strict');
const contract=require('../js/customer-purchase-preparation-contract');
const {productExperienceTestContent:fixtures}=require('../api/_lib/controlled-customer-test-content');
const {getValidPublicCustomerWork:publicWork}=require('../api/_lib/customer-public-work-contract');
const {createHandler}=require('../api/_lib/customer-controlled-preparation');
const draft=(selection={size:'medium',colour:'blue'})=>({version:1,workItemId:'test-discover-family',productId:'test-product-childrens-collection',selection,quantity:2,expires:Date.now()+100000});
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(v){this.body=v;return this;}};}
const request=(body={draft:draft(),review:false})=>({method:'POST',headers:{host:'www.demeos.io',origin:'https://www.demeos.io','x-demeos-test-mode':'controlled-preview'},query:{'demeos-test':'1'},body});
const handler=(identity={trustedCustomerIdentityId:'trusted'},owned=[],fixture=fixtures)=>createHandler({authenticate:async()=>identity,repository:()=>({getOwnedBusinessIds:async()=>owned}),fixtures:fixture});
test('one-tab draft contains exact selected references and quantity, no identity or personal details',()=>{
 const d=draft();assert.deepEqual(contract.draft(d),d);
 for(const extra of ['price','availability','customerId','email','address','paymentActive','redirectUrl'])assert.equal(contract.draft({...d,[extra]:'injected'}),null);
 assert.equal(contract.draft({...d,expires:Date.now()-1}),null);assert.equal(contract.draft({...d,quantity:0}),null);assert.equal(contract.draft({...d,quantity:'2'}),null);assert.equal(contract.draft({...d,selection:{...d.selection,forged:'option'}}),null);
});
test('authoritative variant price and availability override browser claims',()=>{
 const r=contract.resolve(publicWork(fixtures()),draft());assert.equal(r.ready,true);assert.equal(r.state.pricing.amount,27);assert.equal(r.state.variantId,'collection-medium-blue');assert.equal(r.state.availability,'limited');
 assert.equal(contract.resolve(publicWork(fixtures()),draft({size:'medium',colour:'black'})).ready,false);
 assert.equal(contract.resolve(publicWork(fixtures()),draft({size:'small',colour:'blue'})).ready,false);
 assert.equal(contract.resolve(publicWork(fixtures()),draft({})).ready,false);
});
test('external marketing cannot enter preparation, even with a valid selected item',()=>{
 assert.equal(contract.resolve(publicWork(fixtures()),{...draft(),workItemId:'test-discover-fashion',productId:'test-product-activewear',quantity:1}).ready,false);
});
test('transaction detail fields are declared per item, with global delivery and no redundant service questions',()=>{
 const delivery=contract.resolve(publicWork(fixtures()),draft());assert.deepEqual(contract.fields(delivery),['address','city','country']);assert.equal(contract.validDetails(delivery,{address:'12 Test Road',city:'Conakry',country:'Guinea'}),true);assert.equal(contract.validDetails(delivery,{address:'12',city:'Conakry',country:'Guinea',card:'secret'}),false);
 const collection=contract.resolve(publicWork(fixtures()),{...draft(),productId:'test-product-childrens-fashion',selection:{},quantity:1});assert.deepEqual(contract.fields(collection),[]);
 const service=contract.resolve(publicWork(fixtures()),{...draft(),workItemId:'test-discover-sports',productId:'test-product-football',selection:{},quantity:1});assert.deepEqual(contract.fields(service),['date']);assert.equal(contract.validDetails(service,{date:'2026-02-30'}),false);assert.equal(contract.validDetails(service,{date:'2026-10-08'}),true);
 const digital={...collection,method:'digital',product:{...collection.product,fulfilment:{methods:['digital'],requiredDetails:[]}}};assert.deepEqual(contract.fields(digital),[]);
});
test('preparation endpoint independently enforces exact test gate, authenticated customer scope, and strict request',async()=>{
 for(const req of [{...request(),query:{}},{...request(),headers:{...request().headers,'x-demeos-test-mode':undefined}},{...request(),headers:{...request().headers,origin:'https://attacker.example'}}]){const res=response();await handler()(req,res);assert.equal(res.statusCode,403);}
 let res=response();await handler(null)(request(),res);assert.equal(res.statusCode,401);
 res=response();await handler(undefined,['owner-business'])(request(),res);assert.equal(res.statusCode,403);
 res=response();await handler()(request({draft:draft(),paymentActive:true}),res);assert.equal(res.statusCode,400);
});
test('final server re-check fails closed for unavailable variants and never creates records or payments',async()=>{
 let res=response();await handler()(request({draft:draft(),review:true,details:{address:'12 Test',city:'Conakry',country:'Guinea'}}),res);assert.equal(res.statusCode,200);assert.equal(res.body.paymentActive,false);assert.equal(res.body.orderCreated,false);assert.equal(JSON.stringify(res.body).includes('trusted'),false);assert.equal(res.headers['Cache-Control'],'private, no-store');
 res=response();await handler(undefined,[],()=>{const work=fixtures();work.find(w=>w.workItemId==='test-discover-family').products.find(p=>p.productId==='test-product-childrens-collection').availability='unavailable';return work;})(request({draft:draft(),review:true,details:{address:'12',city:'Conakry',country:'Guinea'}}),res);assert.equal(res.statusCode,409);
});
test('nine-language preparation catalogue has complete labels and uses the existing selector',()=>{
 const copy=require('../js/demeos-purchase-preparation-copy');const keys=Object.keys(copy.en).sort();assert.deepEqual(Object.keys(copy).sort(),['ar','de','en','es','fr','hi','ja','pt','zh']);for(const [code,c]of Object.entries(copy)){assert.deepEqual(Object.keys(c).sort(),keys);for(const v of Object.values(c))assert.ok(typeof v==='string'&&v.trim());if(code!=='en'){assert.notEqual(c.inactive,copy.en.inactive);assert.notEqual(c.title,copy.en.title);}}
 const fs=require('node:fs');assert.match(fs.readFileSync('js/my-demeos.js','utf8'),/clerk\.openSignIn/);assert.doesNotMatch(fs.readFileSync('js/customer-purchase-preparation.js','utf8'),/createUser|createPayment|localStorage|cardNumber/);
});
test('disabled controlled content blocks preparation and service quantities cannot be duplicated',async()=>{
 const previous=process.env.DEMEOS_CONTROLLED_TEST_CONTENT;process.env.DEMEOS_CONTROLLED_TEST_CONTENT='disabled';
 try{const res=response();await handler()(request(),res);assert.equal(res.statusCode,403);}finally{if(previous===undefined)delete process.env.DEMEOS_CONTROLLED_TEST_CONTENT;else process.env.DEMEOS_CONTROLLED_TEST_CONTENT=previous;}
 assert.equal(contract.resolve(publicWork(fixtures()),{...draft(),workItemId:'test-discover-sports',productId:'test-product-football',selection:{},quantity:2}).ready,false);
 assert.equal(contract.draft({...draft(),quantity:21}),null);
});
