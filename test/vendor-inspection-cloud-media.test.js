'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const inspection=require('../api/_lib/vendor-inspection'),cloud=require('../api/_lib/vendor-inspection-media');
const {createMediaStorageAdapter,storageKeyFor}=require('../api/_lib/media-storage-adapter');
const {inspectFile,inspectStoredOriginal}=require('../api/_lib/vendor-inspection-source');
const secret='controlled-test-secret-with-at-least-32-characters',identity='controlled-test-owner';
const environment={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'business-approval-application-access-705',BLOB_STORE_ID:cloud.STORE,BLOB_READ_WRITE_TOKEN:'test-only-token',DEMEOS_MEDIA_STORAGE_PROVIDER:'vercel-blob',DEMEOS_MEDIA_UPLOAD_SECRET:secret,DEMEOS_INSPECTION_MEDIA_IDENTITY_ID:identity};
const base='/api/businesses/test-vendor-inspection-705/media';
function setup(options={}){
 let clock=Date.now(),reads=0,verified=true;const uploads=[];
 const storage=createMediaStorageAdapter({async createUpload(a){uploads.push(a);return {...a,uploadUrl:'https://test.blob.vercel-storage.com/upload?signature=controlled'};},async verifyUpload(a){const upload=uploads.find(u=>u.storageKey===a.storageKey);return upload&&{...upload,exists:verified};},async createDeliveryRead(a){reads++;return {...a,deliveryUrl:'https://test.blob.vercel-storage.com/read?signature='+reads};}});
 const media=cloud.createCloudMedia({env:environment,storage,now:()=>clock,inspectSource:async()=>({width:1402,height:1122}),...options});
 const state=inspection.fixture('https://preview.example');
 const asset={kind:'image',purpose:'product',relatedEntityId:state.profile.products[0].productId,contentType:'image/webp',sizeBytes:7};
 return {media,state,asset,uploads,get reads(){return reads;},advance(ms){clock+=ms;},setVerified(value){verified=value;}};
}
async function signed(test,callback){const old=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;process.env.DEMEOS_MEDIA_UPLOAD_SECRET=secret;try{await callback();}finally{if(old===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=old;}}
async function register(s){return s.media.operate(s.state,identity,base,'POST',{asset:s.asset});}
async function complete(s,r){return s.media.operate(s.state,identity,base+'/'+r.asset.assetId,'PATCH',{action:'complete-upload',uploadToken:r.uploadSession.uploadToken,storageKey:r.uploadSession.storageKey});}
test('private inspection media is gated to the exact Preview branch, store and test identity',()=>{
 assert.equal(cloud.permitted(environment,identity),true);assert.equal(cloud.permitted(environment,'another-owner'),false);
 for(const changes of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{BLOB_STORE_ID:'another-store'},{DEMEOS_INSPECTION_MEDIA_IDENTITY_ID:''},{DEMEOS_MEDIA_UPLOAD_SECRET:''}])assert.equal(cloud.configured({...environment,...changes}),false);
 assert.equal(cloud.createCloudMedia({env:{...environment,VERCEL_ENV:'production'},storage:{}}),null);
});
test('verified original upload survives restored state and receives a fresh private link',async t=>signed(t,async()=>{
 const s=setup(),r=await register(s);assert.equal(r.asset.state,'pending-upload');assert.equal(r.asset.deliveryUrl,undefined);assert.match(r.asset.assetId,/^test-cloud-/);
 const done=await complete(s,r);assert.equal(done.asset.state,'ready');assert.equal(done.asset.width,1402);assert.equal(s.state.profile.applicationAccess,undefined);assert.deepEqual(inspection.operate(s.state,'/api/businesses/test-vendor-inspection-705/orders','GET',{}).orders,[]);
 const saved=structuredClone(s.state),original=saved.assets.at(-1).deliveryUrl;await s.media.hydrate(saved,identity);assert.equal(saved.assets.at(-1).deliveryUrl,original);
 s.advance(14*60*1000);await s.media.hydrate(saved,identity);assert.notEqual(saved.assets.at(-1).deliveryUrl,original);assert.equal(saved.assets.at(-1).storageKey,undefined);
 await complete(s,r); // Completion replay within the signed upload session is idempotent.
}));
test('forged readiness, another owner, changed metadata and client storage paths cannot open private records',async t=>signed(t,async()=>{
 const s=setup(),r=await register(s);await complete(s,r);
 for(const change of [{state:'pending-upload'},{relatedEntityId:'another-product'},{sizeBytes:999},{businessId:'real-business'},{assetId:123}]){
  const copy=structuredClone(s.state);Object.assign(copy.assets.at(-1),change);if(change.assetId===123)assert.equal(cloud.authentic(copy.assets.at(-1),identity,secret),false);else await assert.rejects(s.media.hydrate(copy,identity),{status:403});
 }
 await assert.rejects(s.media.hydrate(structuredClone(s.state),'another-owner'),{status:403});
 const copy=structuredClone(s.state);Object.assign(copy.assets.at(-1),{storageKey:'businesses/real-business/private',deliveryUrl:'https://evil.example/private',derivatives:[{storageKey:'private'}]});await s.media.hydrate(copy,identity);assert.match(copy.assets.at(-1).deliveryUrl,/test\.blob\.vercel-storage\.com/);assert.equal(copy.assets.at(-1).derivatives,undefined);assert.equal(copy.assets.at(-1).storageKey,undefined);
}));
test('uploads validate product binding, MIME, size and duration without trusting client URLs',async t=>signed(t,async()=>{
 for(const changes of [{purpose:'marketing'},{relatedEntityId:'real-product'},{contentType:'image/svg+xml'},{sizeBytes:16*1024*1024},{sizeBytes:0},{kind:'video',contentType:'video/mp4',durationSeconds:61}]){const s=setup();Object.assign(s.asset,changes);await assert.rejects(register(s),{status:400});assert.equal(s.uploads.length,0);}
 const s=setup();Object.assign(s.asset,{storageKey:'private',deliveryUrl:'https://evil.example',state:'ready',derivatives:[{storageKey:'private'}]});const r=await register(s);assert.equal(r.asset.state,'pending-upload');assert.equal(r.asset.storageKey,undefined);assert.equal(r.asset.derivatives,undefined);
}));
test('unverified bytes, invalid originals and expired sessions never become ready',async t=>signed(t,async()=>{
 const s=setup(),r=await register(s);s.setVerified(false);await assert.rejects(complete(s,r),{status:409});assert.equal(r.asset.state,'pending-upload');
 s.setVerified(true);s.advance(16*60*1000);await assert.rejects(complete(s,r),{status:409});
 const bad=setup({inspectSource:async()=>{const error=Error('Choose a valid JPG, PNG or WebP image.');error.status=409;throw error;}}),registered=await register(bad);await assert.rejects(complete(bad,registered),{status:409});assert.equal(registered.asset.state,'pending-upload');
}));
test('storage failures return a fixed recovery message and never disclose provider credentials',async t=>signed(t,async()=>{
 const s=setup({storage:{async createUpload(){throw Error('private provider URL and credential');}}});await assert.rejects(register(s),error=>error.status===503&&!error.message.includes('credential'));assert.equal(s.state.assets.some(a=>a.assetId.startsWith('test-cloud-')),false);
}));
test('actual image and video probes inspect the bytes rather than the supplied filename',async()=>{
 assert.deepEqual(await inspectFile('images/controlled-test/childrens-fashion.webp',{kind:'image',contentType:'image/webp'}),{width:1402,height:1122});
 const video=await inspectFile('images/vendor-inspection/sample-jacket.mp4',{kind:'video',contentType:'video/mp4'});assert.equal(video.durationSeconds,3);assert.equal(video.width,640);
 await assert.rejects(inspectFile('images/controlled-test/childrens-fashion.webp',{kind:'image',contentType:'image/png'}),{status:409});
 await assert.rejects(inspectFile('images/controlled-test/childrens-fashion.webp',{kind:'video',contentType:'video/mp4'}),{status:409});
});
test('stored-original inspection bounds streamed bytes and refuses untrusted sources',async()=>{
 let checks=0;const inspect=async filename=>{checks++;assert.equal(fs.readFileSync(filename).toString(),'valid');return {width:1,height:1};};
 const fetchImpl=async()=>new Response('valid');const asset={sizeBytes:5};
 assert.deepEqual(await inspectStoredOriginal(asset,'https://test.blob.vercel-storage.com/read',{fetchImpl,inspect}),{width:1,height:1});
 for(const sizeBytes of [4,6])await assert.rejects(inspectStoredOriginal({sizeBytes},'https://test.blob.vercel-storage.com/read',{fetchImpl,inspect}),{status:409});
 await assert.rejects(inspectStoredOriginal(asset,'https://evil.example/read',{fetchImpl,inspect}),{status:409});assert.equal(checks,1);
});
test('browser permits only its issued upload URL, exact file and current authenticated account',async t=>signed(t,async()=>{
 const s=setup(),calls=[],values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size;}};
 const root={DEMEOS_VENDOR_INSPECTION:{identityId:identity,cloudMedia:true,state:s.state},location:{pathname:'/selling-vendor/inspect/manage',origin:'https://preview.example'},localStorage:storage,sessionStorage:storage,Clerk:{user:{id:identity},session:{getToken:async()=>'controlled-token'}},fetch:async(url,options)=>{calls.push(String(url));if(String(url).startsWith('https://'))return new Response('{}');const req=JSON.parse(options.body);await s.media.hydrate(req.state,identity);const result=await s.media.operate(req.state,identity,req.pathname,req.method,req.body)||inspection.operate(req.state,req.pathname,req.method,req.body);return new Response(JSON.stringify({state:req.state,result}));}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/vendor-inspection'),'utf8'),{window:root,document:{addEventListener(){}},URL,Response,Blob,structuredClone,crypto:require('node:crypto').webcrypto});
 const r=await (await root.fetch(base,{method:'POST',body:JSON.stringify({asset:s.asset})})).json();assert.ok(r.asset);const upload=r.uploadSession.uploadUrl,file=new Blob(['1234567'],{type:'image/webp'});
 assert.equal((await root.fetch(upload,{method:'PUT',body:file})).status,200);
 assert.equal((await root.fetch(upload+'&altered=1',{method:'PUT',body:file})).status,403);
 assert.equal((await root.fetch(upload,{method:'PUT',body:new Blob(['x'],{type:'image/webp'})})).status,403);
 const completed=await root.fetch(base+'/'+r.asset.assetId,{method:'PATCH',body:JSON.stringify({action:'complete-upload',uploadToken:r.uploadSession.uploadToken,storageKey:r.uploadSession.storageKey})});assert.equal(completed.status,200);assert.equal((await root.fetch(upload,{method:'PUT',body:file})).status,403);
 const r2=await (await root.fetch(base,{method:'POST',body:JSON.stringify({asset:s.asset})})).json();root.Clerk.user.id='another-owner';assert.equal((await root.fetch(r2.uploadSession.uploadUrl,{method:'PUT',body:file})).status,403);
 assert.equal(calls.filter(url=>url.startsWith('https://')).length,1);assert.ok([...values.values()].some(value=>value.includes('test-cloud-')));
}));
