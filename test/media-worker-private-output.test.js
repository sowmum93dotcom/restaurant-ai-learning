const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaWorker}=require("../api/_lib/media-worker.js");
test("worker delegates bounded private processor outputs without permanent storage credentials",async()=>{
 const asset={assetId:"a1",businessId:"b1",kind:"image",state:"processing",storageKey:"businesses/b1/media/a1/original",contentType:"image/png"};let context;
 const repository={async recoverStaleMediaProcessingJobs(){return[];},async reconcileUnqueuedProcessingMedia(){return[];},async claimNextMediaProcessingJob(){return{job_id:1,asset_id:"a1",business_id:"b1",attempts:1};},async getBusinessMediaAsset(){return asset;},async retryMediaProcessingJob(){return{status:"queued"};}};
 const worker=createMediaWorker({repository,drivers:{async inspectImage(a,c){context=c;return{contentType:"image/png",width:1200,height:800};},async optimizeImage(){return null;}},async createProcessingRead({storageKey,expiresAt}){return{storageKey,readUrl:"https://private.example/read",expiresAt};},async createProcessingWrite(o){return{...o,uploadUrl:"https://private.example/write"};}});
 const result=await worker();assert.equal(result.status,"retrying");assert.equal(context.outputDestinations.length,4);assert.deepEqual(context.outputDestinations.map(x=>x.role),["master","thumbnail","customer","marketing"]);assert.ok(context.outputDestinations.every(x=>x.storageKey.startsWith("businesses/b1/media/a1/processed/")));
});

test("worker rejects successful processor result when delegated output is not verified in DEMEOS storage",async()=>{
 const asset={assetId:"a1",businessId:"b1",kind:"image",state:"processing",storageKey:"businesses/b1/media/a1/original",contentType:"image/png"};
 let retried=false,completed=false;
 const repository={async recoverStaleMediaProcessingJobs(){return[];},async reconcileUnqueuedProcessingMedia(){return[];},async claimNextMediaProcessingJob(){return{job_id:1,asset_id:"a1",business_id:"b1",attempts:1};},async getBusinessMediaAsset(){return asset;},async retryMediaProcessingJob(){retried=true;return{status:"queued"};},async completeMediaProcessingJob(){completed=true;}};
 const worker=createMediaWorker({repository,
  drivers:{async inspectImage(){return{contentType:"image/png",width:1200,height:800};},async optimizeImage(_a,_i,ctx){const m=ctx.outputDestinations.find(x=>x.role==="master"),d=ctx.outputDestinations.filter(x=>x.role!=="master");return{storageKey:m.storageKey,deliveryUrl:"https://delivery.example/master.webp",derivatives:d.map(x=>({role:x.role,storageKey:x.storageKey,deliveryUrl:"https://delivery.example/"+x.role+".webp",width:1200,height:800}))};}},
  async createProcessingRead({storageKey,expiresAt}){return{storageKey,readUrl:"https://private.example/read",expiresAt};},
  async createProcessingWrite(o){return{...o,uploadUrl:"https://private.example/write"};},
  async verifyProcessedOutput(){return null;}
 });
 const result=await worker();assert.equal(result.status,"retrying");assert.equal(retried,true);assert.equal(completed,false);
});
