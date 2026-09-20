const test=require("node:test"),assert=require("node:assert/strict");
const {storageKeyFor,createMediaStorageAdapter}=require("../api/_lib/media-storage-adapter.js");
const asset={businessId:"business-a",assetId:"media-1",kind:"image",contentType:"image/webp",sizeBytes:1234};
test("media storage keys are deterministic and isolated by business and asset",function(){
 assert.equal(storageKeyFor(asset),"businesses/business-a/media/media-1/original");
 assert.notEqual(storageKeyFor({...asset,businessId:"business-b"}),storageKeyFor(asset));
});
test("storage adapter accepts only exact controlled upload destinations",async function(){
 const key=storageKeyFor(asset);
 const adapter=createMediaStorageAdapter({async createUpload(){return{storageKey:key,uploadUrl:"https://upload.example/signed"};},async verifyUpload(){return null;}});
 assert.deepEqual(await adapter.createUpload(asset,{expiresAt:"2026-09-20T10:00:00Z"}),{storageKey:key,uploadUrl:"https://upload.example/signed",expiresAt:"2026-09-20T10:00:00Z"});
 const bad=createMediaStorageAdapter({async createUpload(){return{storageKey:"businesses/other/media/media-1/original",uploadUrl:"https://upload.example/signed"};},async verifyUpload(){return null;}});
 assert.equal(await bad.createUpload(asset,{expiresAt:"x"}),null);
});
test("upload verification requires exact business storage key type and declared size",async function(){
 const key=storageKeyFor(asset);
 const adapter=createMediaStorageAdapter({async createUpload(){return null;},async verifyUpload(){return{exists:true,storageKey:key,contentType:"image/webp",sizeBytes:1234,etag:"etag-1"};}});
 assert.deepEqual(await adapter.verifyUpload(asset,key),{storageKey:key,contentType:"image/webp",sizeBytes:1234,etag:"etag-1"});
 const mismatch=createMediaStorageAdapter({async createUpload(){return null;},async verifyUpload(){return{exists:true,storageKey:key,contentType:"image/png",sizeBytes:1234};}});
 assert.equal(await mismatch.verifyUpload(asset,key),null);
});
