const test=require("node:test"),assert=require("node:assert/strict");
const {createHttpMediaProcessingDrivers}=require("../api/_lib/media-processing-driver.js");
test("processing provider calls receive an abort signal",async()=>{
 let signal;const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example",token:"secret",fetchImpl:async(u,o)=>{signal=o.signal;return{ok:true,json:async()=>({contentType:"image/jpeg",width:1,height:1})};}});
 await d.inspectImage({assetId:"a",businessId:"b",storageKey:"k",contentType:"image/jpeg"},{});assert.ok(signal);assert.equal(typeof signal.aborted,"boolean");
});
test("processing provider network failure is converted to a safe null result",async()=>{
 const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example",token:"secret",fetchImpl:async()=>{throw new Error("provider secret detail");}});
 assert.equal(await d.inspectImage({assetId:"a",businessId:"b",storageKey:"k"},{}),null);
});
