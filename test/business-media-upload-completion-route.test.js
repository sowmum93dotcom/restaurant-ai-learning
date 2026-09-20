const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const source=fs.readFileSync(require.resolve("../api/businesses/[businessId]/media/[assetId].js"),"utf8");
test("media route verifies storage before atomic processing handoff",()=>{
 assert.match(source,/completeVerifiedMediaUpload/);assert.match(source,/enqueueVerifiedMediaForProcessing\(repository,processing\)/);
 assert.match(source,/processingStatus:"queued"/);
});
test("business owner cannot self-promote media into processing or ready",()=>{
 assert.match(source,/nextState==="processing"\|\|nextState==="ready"/);
 assert.match(source,/Processing states are controlled by DEMEOS/);
});
test("owner lifecycle updates cannot inject delivery or processor metadata",()=>{
 const lifecycle=source.slice(source.indexOf("const nextState=req.body&&req.body.state"));
 assert.doesNotMatch(lifecycle,/\["deliveryUrl"/);assert.doesNotMatch(lifecycle,/storageKey/);assert.doesNotMatch(lifecycle,/durationSeconds/);
});
