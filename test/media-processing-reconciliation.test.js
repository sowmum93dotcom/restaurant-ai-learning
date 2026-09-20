const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {reconcileMediaProcessingQueue}=require("../api/_lib/media-processing-queue.js");
test("queue reconciliation delegates with bounded batch intent",async()=>{
 let received;const repo={async reconcileUnqueuedProcessingMedia(limit){received=limit;return[{asset_id:"a1",status:"queued"}];}};
 const rows=await reconcileMediaProcessingQueue(repo,{limit:25});assert.equal(received,25);assert.equal(rows.length,1);
});
test("persistence recovery only finds processing assets with no durable job",()=>{
 const source=fs.readFileSync(require.resolve("../api/_lib/persistence.js"),"utf8");
 const start=source.indexOf("async reconcileUnqueuedProcessingMedia"),end=source.indexOf("async claimNextMediaProcessingJob",start),m=source.slice(start,end);
 assert.match(m,/LEFT JOIN demeos_media_processing_jobs/);assert.match(m,/state' = 'processing'/);assert.match(m,/j\.asset_id IS NULL/);
 assert.match(m,/SKIP LOCKED/);assert.match(m,/Math\.min\(200/);
});
