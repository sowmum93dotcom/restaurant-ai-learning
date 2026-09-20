const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeMediaAsset,MAX_VIDEO_BYTES}=require("../api/_lib/media-asset-contract.js");
test("V1 video media has a bounded source byte policy",()=>{
 assert.equal(MAX_VIDEO_BYTES,250*1024*1024);
 const base={assetId:"v1",businessId:"b1",kind:"video",state:"pending-upload",contentType:"video/mp4"};
 assert.ok(normalizeMediaAsset({...base,sizeBytes:MAX_VIDEO_BYTES},"b1"));
 assert.equal(normalizeMediaAsset({...base,sizeBytes:MAX_VIDEO_BYTES+1},"b1"),null);
});
