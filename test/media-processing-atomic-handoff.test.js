const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {enqueueVerifiedMediaForProcessing}=require("../api/_lib/media-processing-queue.js");
const asset={assetId:"media-1",businessId:"business-a",kind:"image",state:"processing",contentType:"image/webp",sizeBytes:1234};
test("verified processing media uses atomic persistence and queue handoff",async()=>{
 let legacy=false;const repository={
  async saveProcessingMediaAndEnqueue(b,a){assert.equal(b,"business-a");assert.equal(a,asset);return{asset:a,job:{status:"queued"}};},
  async enqueueMediaProcessingJob(){legacy=true;}
 };
 const result=await enqueueVerifiedMediaForProcessing(repository,asset);
 assert.equal(result.job.status,"queued");assert.equal(legacy,false);
});
test("atomic handoff persists processing asset and queue job in one SQL statement",()=>{
 const source=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 const start=source.indexOf("async saveProcessingMediaAndEnqueue");const end=source.indexOf("async enqueueMediaProcessingJob",start);
 const method=source.slice(start,end);
 assert.match(method,/WITH locked_business AS/);assert.match(method,/saved AS/);assert.match(method,/queued AS/);
 assert.match(method,/demeos_business_media_assets/);assert.match(method,/demeos_media_processing_jobs/);
 assert.equal((method.match(/database\.query\(/g)||[]).length,1);
});
test("atomic handoff rejects non-processing assets before persistence",async()=>{
 let called=false;const repository={async saveProcessingMediaAndEnqueue(){called=true;}};
 assert.equal(await enqueueVerifiedMediaForProcessing(repository,{...asset,state:"pending-upload"}),null);assert.equal(called,false);
});
