const test=require("node:test"),assert=require("node:assert/strict");
const {createVercelBlobStorageDriver}=require("../api/_lib/media-storage-driver.js");
test("Vercel Blob processing output delegation is exact private PUT only and bounded",async()=>{
 const calls=[];const sdk={async issueSignedToken(o){calls.push(["issue",o]);return"token";},async presignUrl(t,o){calls.push(["presign",o]);return{presignedUrl:"https://blob.example/upload"};}};
 const driver=createVercelBlobStorageDriver({token:"secret",blobSdkLoader:async()=>sdk});
 const expiresAt=new Date(Date.now()+300000).toISOString(),storageKey="businesses/b1/media/a1/processed/customer.webp";
 const out=await driver.createProcessingWrite({storageKey,contentType:"image/webp",maximumSizeInBytes:1024,expiresAt});
 assert.equal(out.storageKey,storageKey);assert.equal(out.contentType,"image/webp");
 assert.deepEqual(calls[0][1].operations,["put"]);assert.equal(calls[0][1].pathname,storageKey);assert.deepEqual(calls[0][1].allowedContentTypes,["image/webp"]);assert.equal(calls[0][1].maximumSizeInBytes,1024);
 assert.equal(calls[1][1].access,"private");assert.equal(calls[1][1].operation,"put");assert.equal(calls[1][1].allowOverwrite,true);assert.equal(calls[1][1].addRandomSuffix,false);
});
test("processing output delegation fails closed for invalid expiry or bounds",async()=>{
 const driver=createVercelBlobStorageDriver({token:"secret",blobSdkLoader:async()=>({})});
 assert.equal(await driver.createProcessingWrite({storageKey:"x",contentType:"image/webp",maximumSizeInBytes:0,expiresAt:new Date(Date.now()+1000).toISOString()}),null);
});
