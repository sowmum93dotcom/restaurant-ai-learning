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

 test('inspection mutations bind the authenticated account and never accept another account context',async()=>{
 const environment=()=>({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch});const handler=inspection.createHandler({environment,authenticate:async()=>({trustedIdentityId:'owner-b'})});
 const req={method:'POST',headers:{host:'preview.example',origin:'https://preview.example'},query:{},body:{identityId:'owner-a',state:inspection.fixture('https://preview.example'),pathname:'/api/businesses',method:'GET'}};
 let res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(res.body.reason,'inspection-account-changed');
 res=response();req.body.identityId='owner-b';await handler(req,res);assert.equal(res.code,200);assert.equal(res.body.result.businesses[0].businessId,'test-vendor-inspection-705');
 });

test('transient inspection failure retains same-account sample reads and recovers without freezing or permitting writes',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),timers=new Set(),workspace={inert:false};let failure=false,calls=0;
 const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),key:index=>[...data.keys()][index],get length(){return data.size;}};};
 const root={DEMEOS_VENDOR_INSPECTION:{identityId:'verified-owner',state:inspection.fixture('https://preview.example')},location:{pathname:'/selling-vendor/inspect/manage',origin:'https://preview.example'},localStorage:storage(),sessionStorage:storage(),Clerk:{user:{id:'verified-owner'},session:{getToken:async()=>'controlled-token'}},setTimeout(fn,ms){const timer={fn,ms};timers.add(timer);return timer;},clearTimeout:timer=>timers.delete(timer),fetch:async(_url,options)=>{calls++;if(failure)return new Response('{}',{status:503});const body=JSON.parse(options.body);return new Response(JSON.stringify({state:body.state,result:inspection.operate(body.state,body.pathname,body.method,body.body)}));}};
 const doc={hidden:false,addEventListener(){},getElementById:id=>id==='owner-authenticated-workspace'?workspace:null};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/vendor-inspection'),'utf8'),{window:root,document:doc,URL,Response,Blob,structuredClone,crypto:require('node:crypto').webcrypto});
 const base='/api/businesses/test-vendor-inspection-705';
 const original=await (await root.fetch(base+'/products')).json();failure=true;await root.DEMEOSVendorInspection.revalidate();
 assert.equal(workspace.inert,false);assert.equal(root.DEMEOSVendorInspection.isPaused(),true);
 const callsBefore=calls;assert.deepEqual(await (await root.fetch(base+'/products')).json(),original);
 assert.equal((await root.fetch(base+'/inventory',{method:'PUT',body:'{}'})).status,503);assert.equal((await root.fetch('/api/businesses/another-business/products')).ok,false);assert.equal(calls,callsBefore);
 failure=false;const retry=[...timers].find(timer=>timer.ms===2000);assert.ok(retry);timers.delete(retry);retry.fn();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(root.DEMEOSVendorInspection.isPaused(),false);assert.equal(workspace.inert,false);assert.equal(timers.size,0);
 failure=true;await root.DEMEOSVendorInspection.revalidate();root.Clerk.user={id:'another-account'};root.DEMEOSVendorInspection.sessionChanged({user:root.Clerk.user},root.Clerk.session);
 assert.equal(workspace.inert,true);assert.equal(root.DEMEOSVendorInspection.authenticationRequired(),true);assert.equal((await root.fetch(base+'/products')).ok,false);assert.equal(timers.size,0);
});

test('Selling test entry never reads obsolete shared dashboard templates',async()=>{
 const fs=require('node:fs'),original=fs.readFileSync,read=[];
 fs.readFileSync=function(file,...args){read.push(String(file));assert.ok(!/(?:^|\/)(?:business-workspace|marketing)\.html$/.test(String(file)),'Obsolete Selling entry was read');return original.call(this,file,...args);};
 try{
  for(const authenticated of [false,true])for(const page of ['dashboard','manage']){
   const handler=inspection.createHandler({environment:()=>({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch}),authenticate:async()=>authenticated?{trustedIdentityId:'controlled-test-owner'}:null});
   const res=response();await handler({method:'GET',headers:{host:'preview.example'},query:{page}},res);
   assert.equal(res.code,200);assert.match(res.body,/Selling Vendor Application/);assert.doesNotMatch(res.body,/href="(?:\/?business-workspace\.html|marketing\.html)/);
   if(authenticated&&page==='manage'){assert.match(res.body,/id="business-media-file"/);assert.match(res.body,/id="business-media-upload-btn"/);assert.match(res.body,/id="vendor-stock-save"/);}
  }
  assert.ok(read.some(file=>file.endsWith('/selling-vendor.html')));assert.ok(read.some(file=>file.endsWith('/selling-vendor-manage.html')));
  assert.equal(require('../vercel.json').functions['api/businesses.js'].includeFiles,'{selling-vendor.html,selling-vendor-manage.html}');
 }finally{fs.readFileSync=original;}
});
