'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const inspection=require('../api/_lib/vendor-inspection');
const branch='business-approval-application-access-705';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;}};}
test('inspection fails closed in Production, missing environment and other Preview branches before authentication',async()=>{
 for(const env of [{},{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:branch},{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'other'},{VERCEL_ENV:'development',VERCEL_GIT_COMMIT_REF:branch}]){
  let authCalls=0;const handler=inspection.createHandler({environment:()=>env,authenticate:async()=>{authCalls++;throw Error('must not authenticate');}}),res=response();await handler({method:'GET',query:{page:'dashboard'},headers:{}},res);assert.equal(res.code,404);assert.equal(authCalls,0);assert.ok(!JSON.stringify(res.body).includes('sample'));
 }
});
test('Preview inspection requires a real verified identity and same-origin mutation',async()=>{
 const environment=()=>({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch});
 let handler=inspection.createHandler({environment,authenticate:async()=>null}),res=response();await handler({method:'GET',query:{page:'dashboard'},headers:{}},res);assert.equal(res.code,200);assert.ok(!res.body.includes('Development sample shop'));assert.ok(!res.body.includes('DEMEOS_VENDOR_INSPECTION'));assert.match(res.body,/window.DEMEOSVendorInspectionEntry=true/);assert.ok(!/href="\/?business-workspace\.html"/.test(res.body));assert.match(res.body,/href="\/selling-vendor\/inspect"/);
 res=response();await handler({method:'POST',headers:{},query:{}},res);assert.equal(res.code,401);
 handler=inspection.createHandler({environment,authenticate:async()=>({trustedIdentityId:'verified-owner'})});
 for(const origin of [undefined,'https://untrusted.example']){res=response();await handler({method:'POST',headers:{host:'preview.example',origin},body:{}},res);assert.equal(res.code,403);}
 res=response();await handler({method:'GET',headers:{host:'preview.example'},query:{page:'dashboard'}},res);assert.equal(res.code,200);assert.match(res.body,/vendor-inspection.js/);assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('sample catalogue and stock reuse validation, remain separate from approvals, orders and live businesses',()=>{
 const state=inspection.fixture('https://preview.example'),id=state.profile.businessId,base='/api/businesses/'+id;
 assert.equal(state.profile.applicationAccess,undefined);assert.equal(inspection.record(state).workspaceReadiness.onboarding.approved,false);
 assert.deepEqual(inspection.operate(state,base+'/orders','GET',{}).orders,[]);
 const catalogue=inspection.operate(state,base+'/products','GET',{});
 const edited=structuredClone(catalogue.products);edited[0].name='Edited controlled sample';
 const saved=inspection.operate(state,base+'/products','PUT',{products:edited,accuracyConfirmed:true,catalogueRevision:catalogue.catalogueRevision});assert.equal(saved.products[0].name,edited[0].name);
 assert.throws(()=>inspection.operate(state,base+'/products','PUT',{products:edited,accuracyConfirmed:true,catalogueRevision:catalogue.catalogueRevision}),/Reload/);
 const stock=inspection.operate(state,base+'/inventory','GET',{});assert.equal(stock.rows.length,2);
 inspection.operate(state,base+'/inventory','PUT',{revision:stock.revision,catalogueRevision:stock.catalogueRevision,changes:[{productId:edited[0].productId,variantId:'test-medium',onHand:12,lowStock:3,sku:'SAMPLE-M',reason:'Controlled inspection'}]});
 const updated=inspection.operate(state,base+'/inventory','GET',{});assert.equal(updated.rows[0].onHand,12);assert.equal(updated.history.length,1);
 for(const [url,verb] of [[base,'PUT'],['/api/businesses/real','GET'],['/api/admin/business-applications','POST'],['/api/customer/checkout','POST']])assert.throws(()=>inspection.operate(state,url,verb,{action:'submit-business'}),/unavailable/);
 assert.equal(state.profile.applicationAccess,undefined);assert.equal(state.profile.applicationDecisions,undefined);
});
test('browser sandbox isolates owner caches and never forwards unsupported live operations',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const makeStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size;}};};
 const local=makeStorage(),session=makeStorage();local.setItem('demeosBusinessProfiles','real owner cache');local.setItem('clerk-marker','existing auth');const calls=[];
 const root={DEMEOS_VENDOR_INSPECTION:{identityId:'verified-owner',state:inspection.fixture('https://preview.example')},location:{pathname:'/selling-vendor/inspect',origin:'https://preview.example'},localStorage:local,sessionStorage:session,fetch:async(url,options)=>{calls.push(url);const request=JSON.parse(options.body);try{return new Response(JSON.stringify({state:request.state,result:inspection.operate(request.state,request.pathname,request.method,request.body)}));}catch(error){return new Response(JSON.stringify({error:error.message}),{status:error.status});}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/vendor-inspection'),'utf8'),{window:root,document:{addEventListener(){}},URL,Response,Blob,structuredClone,crypto:require('node:crypto').webcrypto});
 root.localStorage.setItem('demeosBusinessProfiles','sample cache');assert.equal(local.getItem('demeosBusinessProfiles'),'real owner cache');assert.equal(root.localStorage.getItem('demeosBusinessProfiles'),'sample cache');assert.equal(root.localStorage.getItem('clerk-marker'),'existing auth');
 assert.equal((await root.fetch('/api/businesses',{method:'GET'})).status,200);assert.deepEqual(calls,['/api/businesses?resource=vendor-inspection']);
 for(const url of ['/api/admin/business-applications','/api/customer/checkout','/api/businesses/real/products'])assert.equal((await root.fetch(url,{method:'POST',body:'{}'})).status,403);
 assert.equal(calls.length,1);assert.equal((await root.fetch('/api/businesses/test-vendor-inspection-705',{method:'PUT',body:'{}'})).status,403);
});
