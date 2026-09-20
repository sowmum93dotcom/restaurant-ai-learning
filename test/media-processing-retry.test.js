const test=require("node:test"),assert=require("node:assert/strict");
const {processNextMediaJob}=require("../api/_lib/media-processing-queue.js");
function asset(){return {assetId:"a1",businessId:"b1",kind:"image",state:"processing",contentType:"image/jpeg",sizeBytes:1000,createdAt:"2026-09-20T10:00:00.000Z"};}
test("processing failure is requeued while attempts remain",async()=>{
 let finished=false,saved=false;
 const repo={claimNextMediaProcessingJob:async()=>({job_id:1,asset_id:"a1",business_id:"b1",attempts:1}),
  getBusinessMediaAsset:async()=>asset(),retryMediaProcessingJob:async()=>({status:"queued"}),finishMediaProcessingJob:async()=>{finished=true},
  saveBusinessMediaAsset:async()=>{saved=true}};
 const r=await processNextMediaJob(repo,async()=>({success:false,error:"temporary"}),{maxAttempts:3});
 assert.equal(r.status,"retrying");assert.equal(finished,false);assert.equal(saved,false);
});
test("terminal processing failure marks owned asset failed safely",async()=>{
 let saved,finished=false;
 const repo={claimNextMediaProcessingJob:async()=>({job_id:2,asset_id:"a1",business_id:"b1",attempts:3}),
  getBusinessMediaAsset:async()=>asset(),retryMediaProcessingJob:async()=>({status:"failed"}),
  finishMediaProcessingJob:async()=>{finished=true;return {status:"failed"};},saveBusinessMediaAsset:async(_b,a)=>{saved=a;return a}};
 const r=await processNextMediaJob(repo,async()=>{throw new Error("provider secret details")},{maxAttempts:3});
 assert.equal(r.status,"failed");assert.equal(finished,true);assert.equal(saved.state,"failed");
 assert.equal(saved.failureReason,"Media processing could not be completed.");
});
test("retry persistence uses bounded exponential delay and max attempts",async()=>{
 const fs=require("node:fs"),source=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 assert.match(source,/retryMediaProcessingJob/);assert.match(source,/POWER\(2/);assert.match(source,/LEAST\(300/);assert.match(source,/attempts < \$4/);
});
