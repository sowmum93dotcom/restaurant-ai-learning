const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeProcessingResult}=require("../api/_lib/media-processing-result.js");
const {processNextMediaJob}=require("../api/_lib/media-processing-queue.js");
const image={assetId:"a1",businessId:"b1",kind:"image",state:"processing",contentType:"image/webp",createdAt:"2026-09-20T09:00:00Z"};
test("optimized image results require secure delivery and dimensions",function(){
 assert.deepEqual(normalizeProcessingResult(image,{success:true,deliveryUrl:"https://cdn.example/a.webp",width:1200,height:800}),{deliveryUrl:"https://cdn.example/a.webp",width:1200,height:800});
 assert.equal(normalizeProcessingResult(image,{success:true,deliveryUrl:"http://cdn.example/a.webp",width:1200,height:800}),null);
 assert.equal(normalizeProcessingResult(image,{success:true,deliveryUrl:"https://cdn.example/a.webp"}),null);
});
test("optimized video results require dimensions and bounded duration",function(){
 const video={...image,kind:"video",contentType:"video/mp4"};
 assert.ok(normalizeProcessingResult(video,{success:true,deliveryUrl:"https://cdn.example/a.mp4",width:1080,height:1920,durationSeconds:30}));
 assert.equal(normalizeProcessingResult(video,{success:true,deliveryUrl:"https://cdn.example/a.mp4",width:1080,height:1920,durationSeconds:61}),null);
});
test("worker persists ready asset before completing durable job",async function(){
 const events=[];const repo={
  async claimNextMediaProcessingJob(){return{job_id:9,asset_id:"a1",business_id:"b1",attempts:1};},
  async getBusinessMediaAsset(){return image;},
  async saveBusinessMediaAsset(b,a){events.push(["asset",b,a.state,a.deliveryUrl]);return a;},
  async finishMediaProcessingJob(id,ok){events.push(["job",id,ok]);}
 };
 const out=await processNextMediaJob(repo,async()=>({success:true,deliveryUrl:"https://cdn.example/a.webp",width:1600,height:900}));
 assert.equal(out.status,"completed");assert.equal(out.asset.state,"ready");
 assert.deepEqual(events,[["asset","b1","ready","https://cdn.example/a.webp"],["job",9,true]]);
});
test("invalid processor output fails job and never publishes media",async function(){
 let saved=false,finished;const repo={
  async claimNextMediaProcessingJob(){return{job_id:10,asset_id:"a1",business_id:"b1",attempts:1};},
  async getBusinessMediaAsset(){return image;},async saveBusinessMediaAsset(){saved=true;},
  async retryMediaProcessingJob(){return {status:"failed"};}, async finishMediaProcessingJob(...x){finished=x;}
 };
 const out=await processNextMediaJob(repo,async()=>({success:true,deliveryUrl:"https://cdn.example/a.webp"}));
 assert.equal(out.status,"failed");assert.equal(saved,true);assert.equal(finished[1],false);
});
