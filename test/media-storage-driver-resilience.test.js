const test=require("node:test"),assert=require("node:assert/strict");
const {createHttpObjectStorageDriver}=require("../api/_lib/media-storage-driver.js");
test("storage calls receive abort signals and tolerate provider network failure",async()=>{
 let signal;const ok=createHttpObjectStorageDriver({baseUrl:"https://storage.example",token:"secret",fetchImpl:async(u,o)=>{signal=o.signal;return{ok:true,json:async()=>({uploadUrl:"https://upload.example/x"})};}});
 const created=await ok.createUpload({storageKey:"businesses/b/media/a/original",contentType:"image/jpeg",sizeBytes:1,expiresAt:"soon"});
 assert.ok(signal);assert.equal(created.uploadUrl,"https://upload.example/x");
 const bad=createHttpObjectStorageDriver({baseUrl:"https://storage.example",token:"secret",fetchImpl:async()=>{throw new Error("private provider error");}});
 assert.equal(await bad.createUpload({storageKey:"businesses/b/media/a/original"}),null);
 assert.equal(await bad.verifyUpload({storageKey:"businesses/b/media/a/original"}),null);
});
test("malformed upload provider response fails closed",async()=>{
 const d=createHttpObjectStorageDriver({baseUrl:"https://storage.example",token:"secret",fetchImpl:async()=>({ok:true,json:async()=>{throw new Error("bad json")}})});
 assert.equal(await d.createUpload({storageKey:"businesses/b/media/a/original"}),null);
});
