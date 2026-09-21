const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaProcessor}=require("../api/_lib/media-processor.js");
const image={assetId:"i1",businessId:"b1",kind:"image",state:"processing",storageKey:"businesses/b1/media/i1/original"};
const video={assetId:"v1",businessId:"b1",kind:"video",state:"processing",storageKey:"businesses/b1/media/v1/original"};
const imageContext={outputDestinations:[{role:"master",storageKey:"businesses/b1/media/i1/processed/master.webp"},{role:"customer",storageKey:"businesses/b1/media/i1/processed/customer.webp"}]};
const videoContext={outputDestinations:[{role:"master",storageKey:"businesses/b1/media/v1/processed/master.mp4"},{role:"customer",storageKey:"businesses/b1/media/v1/processed/customer.mp4"}]};
test("image processor inspects actual media before optimization",async()=>{
 const calls=[];const p=createMediaProcessor({
  inspectImage:async()=>{calls.push("inspect");return{contentType:"image/jpeg",width:1600,height:1200};},
  optimizeImage:async()=>{calls.push("optimize");return{storageKey:"businesses/b1/media/i1/processed/master.webp",deliveryUrl:"https://cdn.example/i.webp",derivatives:[{role:"customer",storageKey:"businesses/b1/media/i1/processed/customer.webp",deliveryUrl:"https://cdn.example/c.webp",width:1200,height:900}]};}
 });const r=await p(image,imageContext);assert.equal(r.success,true);assert.deepEqual(calls,["inspect","optimize"]);assert.equal(r.width,1600);
});
test("video processor rejects inspected source over sixty seconds before transcode",async()=>{
 let transcoded=false;const p=createMediaProcessor({
  inspectVideo:async()=>({contentType:"video/mp4",width:1080,height:1920,durationSeconds:61}),
  transcodeVideo:async()=>{transcoded=true;}
 });const r=await p(video);assert.equal(r.success,false);assert.equal(transcoded,false);
});
test("processor fails closed when media drivers are not configured",async()=>{
 const p=createMediaProcessor({});assert.equal((await p(image)).success,false);assert.equal((await p(video)).success,false);
});
test("video processor returns verified metadata and optimized derivatives",async()=>{
 const p=createMediaProcessor({
  inspectVideo:async()=>({contentType:"video/mp4",width:1080,height:1920,durationSeconds:24}),
  transcodeVideo:async()=>({storageKey:"businesses/b1/media/v1/processed/master.mp4",deliveryUrl:"https://cdn.example/v.mp4",derivatives:[{role:"customer",storageKey:"businesses/b1/media/v1/processed/customer.mp4",deliveryUrl:"https://cdn.example/vc.mp4",contentType:"video/mp4",width:720,height:1280,durationSeconds:24}]})
 });const r=await p(video,videoContext);assert.equal(r.success,true);assert.equal(r.durationSeconds,24);assert.equal(r.derivatives.length,1);
});

test("processor rejects output claiming a path DEMEOS did not delegate",async()=>{
 const p=createMediaProcessor({inspectImage:async()=>({contentType:"image/jpeg",width:1200,height:800}),optimizeImage:async()=>({storageKey:"businesses/other/media/x/processed/master.webp",deliveryUrl:"https://cdn.example/x.webp",derivatives:[{role:"customer",storageKey:"businesses/other/media/x/processed/customer.webp",deliveryUrl:"https://cdn.example/xc.webp",width:800,height:600}]})});
 const r=await p(image,imageContext);assert.equal(r.success,false);assert.equal(r.error,"Image optimization failed.");
});
