const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaWorker}=require("../api/_lib/media-worker.js");
test("worker delegates an exact short-lived private source before processing",async()=>{
 let delegated,seen;const asset={assetId:"a1",businessId:"b1",kind:"image",state:"processing",storageKey:"businesses/b1/media/a1/original",contentType:"image/jpeg"};
 const repository={recoverStaleMediaProcessingJobs:async()=>[],reconcileUnqueuedProcessingMedia:async()=>[],claimNextMediaProcessingJob:async()=>({job_id:1,asset_id:"a1",business_id:"b1",attempts:1}),getBusinessMediaAsset:async()=>asset,saveBusinessMediaAsset:async()=>{},finishMediaProcessingJob:async()=>{}};
 const drivers={inspectImage:async(a,c)=>(seen=c,{contentType:"image/jpeg",width:1200,height:800}),optimizeImage:async()=>({success:true,deliveryUrl:"https://cdn.example/a.webp",contentType:"image/webp",width:1200,height:800,derivatives:[{role:"customer",deliveryUrl:"https://cdn.example/c.webp",contentType:"image/webp",width:800,height:533}]})};
 const worker=createMediaWorker({repository,drivers,createProcessingRead:async o=>(delegated=o,{readUrl:"https://blob.example/signed",expiresAt:o.expiresAt})});
 await worker();assert.equal(delegated.storageKey,asset.storageKey);assert.equal(seen.sourceUrl,"https://blob.example/signed");assert.ok(seen.sourceExpiresAt);
});
