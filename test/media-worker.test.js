const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaWorker}=require("../api/_lib/media-worker.js");
test("worker reconciles missing work then processes one durable job",async()=>{
 const events=[];const asset={assetId:"a1",businessId:"b1",kind:"image",state:"processing",storageKey:"businesses/b1/media/a1/original",contentType:"image/jpeg"};
 const repository={
  reconcileUnqueuedProcessingMedia:async()=>{events.push("reconcile");return[{asset_id:"recovered"}];},
  claimNextMediaProcessingJob:async()=>{events.push("claim");return{job_id:1,asset_id:"a1",business_id:"b1",attempts:1};},
  getBusinessMediaAsset:async()=>asset,
  saveBusinessMediaAsset:async(_b,a)=>a,finishMediaProcessingJob:async()=>({status:"completed"})
 };
 const worker=createMediaWorker({repository,createProcessingRead:async({storageKey,expiresAt})=>({storageKey,readUrl:"https://private.example/read",expiresAt}),createProcessingWrite:async(o)=>({...o,uploadUrl:"https://private.example/write"}),drivers:{
  inspectImage:async()=>({contentType:"image/jpeg",width:1600,height:1200}),
  optimizeImage:async(_a,_i,context)=>({storageKey:context.outputDestinations.find(x=>x.role==="master").storageKey,deliveryUrl:"https://cdn.example/master.webp",derivatives:[{role:"customer",storageKey:context.outputDestinations.find(x=>x.role==="customer").storageKey,deliveryUrl:"https://cdn.example/customer.webp",width:1200,height:900}]})
 }});
 const result=await worker();assert.equal(result.status,"completed");assert.equal(result.recovered,1);assert.deepEqual(events.slice(0,2),["reconcile","claim"]);
});
test("worker is idle when no durable job is available",async()=>{
 const worker=createMediaWorker({repository:{reconcileUnqueuedProcessingMedia:async()=>[],claimNextMediaProcessingJob:async()=>null}});
 const r=await worker();assert.equal(r.status,"idle");assert.equal(r.processed,null);
});
test("worker fails closed without repository",async()=>{assert.equal((await createMediaWorker({})()).status,"not-configured");});
