const test=require("node:test"),assert=require("node:assert/strict");
const {transitionMediaAsset}=require("../api/_lib/media-processing-lifecycle.js");
const base={assetId:"media-1",businessId:"business-a",kind:"image",state:"pending-upload",contentType:"image/webp",createdAt:"2026-09-20T09:00:00Z"};
test("media lifecycle follows upload processing ready sequence",function(){
 const processing=transitionMediaAsset(base,"business-a","processing",{},"2026-09-20T09:01:00Z");assert.equal(processing.state,"processing");
 const ready=transitionMediaAsset(processing,"business-a","ready",{deliveryUrl:"https://media.example/a.webp",width:1600,height:900},"2026-09-20T09:02:00Z");
 assert.equal(ready.state,"ready");assert.equal(ready.deliveryUrl,"https://media.example/a.webp");
});
test("media cannot become ready without secure delivery or skip controlled lifecycle",function(){
 assert.equal(transitionMediaAsset(base,"business-a","ready",{deliveryUrl:"https://media.example/a.webp"}),null);
 const processing=transitionMediaAsset(base,"business-a","processing");
 assert.equal(transitionMediaAsset(processing,"business-a","ready",{deliveryUrl:"http://media.example/a.webp"}),null);
});
test("failed media records a bounded reason and can be retried through pending upload",function(){
 const failed=transitionMediaAsset(base,"business-a","failed",{failureReason:"upload verification failed"});
 assert.equal(failed.failureReason,"upload verification failed");assert.equal(transitionMediaAsset(failed,"business-a","pending-upload").state,"pending-upload");
});
test("media lifecycle cannot cross business ownership",function(){assert.equal(transitionMediaAsset(base,"business-b","processing"),null);});
