const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {enqueueVerifiedMediaForProcessing,processNextMediaJob}=require("../api/_lib/media-processing-queue.js");
test("verified processing media is enqueued without binary work in web request",async function(){
 const calls=[];const repo={async enqueueMediaProcessingJob(b,a){calls.push([b,a]);return{status:"queued"};}};
 assert.deepEqual(await enqueueVerifiedMediaForProcessing(repo,{businessId:"b1",assetId:"a1",state:"processing"}),{status:"queued"});
 assert.deepEqual(calls,[["b1","a1"]]);
});
test("worker claims one job and records successful completion",async function(){
 const finished=[];const repo={async claimNextMediaProcessingJob(){return{job_id:7,asset_id:"a1",business_id:"b1",attempts:1};},
 async getBusinessMediaAsset(){return{assetId:"a1",businessId:"b1",kind:"image",state:"processing"};},
 async saveBusinessMediaAsset(b,a){return a;},
 async finishMediaProcessingJob(...x){finished.push(x);}};
 const out=await processNextMediaJob(repo,async()=>({success:true,deliveryUrl:"https://media.example/a",width:1200,height:800}));
 assert.equal(out.status,"completed");assert.deepEqual(finished,[[7,true]]);
});
test("worker failure is bounded and persisted without blocking the request path",async function(){
 const finished=[];const repo={async claimNextMediaProcessingJob(){return{job_id:8,asset_id:"a2",business_id:"b1",attempts:2};},
 async getBusinessMediaAsset(){return{assetId:"a2",businessId:"b1",state:"processing"};},
 async finishMediaProcessingJob(...x){finished.push(x);}};
 const out=await processNextMediaJob(repo,async()=>{throw new Error("processor unavailable");});
 assert.equal(out.status,"failed");assert.deepEqual(finished,[[8,false,"processor unavailable"]]);
});
test("database queue uses skip locked and unique asset jobs for concurrent scale",function(){
 const db=fs.readFileSync(require.resolve("../api/_lib/database.js"),"utf8"),p=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 assert.match(db,/UNIQUE \(asset_id\)/);assert.match(p,/FOR UPDATE SKIP LOCKED/);assert.match(p,/attempts < \$1/);
});
