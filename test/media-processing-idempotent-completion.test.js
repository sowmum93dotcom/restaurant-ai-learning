const test=require("node:test"),assert=require("node:assert/strict");
const {processNextMediaJob}=require("../api/_lib/media-processing-queue.js");
test("ready asset completes an interrupted job without running processor again",async()=>{
 let processed=0,finished=[];
 const ready={assetId:"a1",businessId:"b1",kind:"image",state:"ready",deliveryUrl:"https://cdn.example/a1.webp"};
 const repository={
  claimNextMediaProcessingJob:async()=>({job_id:9,asset_id:"a1",business_id:"b1",attempts:2}),
  getBusinessMediaAsset:async()=>ready,
  finishMediaProcessingJob:async(id,ok)=>{finished.push([id,ok]);return{};}
 };
 const result=await processNextMediaJob(repository,async()=>{processed++;return{success:true};});
 assert.equal(processed,0);assert.deepEqual(finished,[[9,true]]);assert.equal(result.status,"completed");assert.equal(result.recoveredCompletion,true);
});
