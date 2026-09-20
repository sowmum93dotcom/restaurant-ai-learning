const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaUploadSession}=require("../api/_lib/media-upload-session.js");
const {createMediaStorageAdapter,storageKeyFor}=require("../api/_lib/media-storage-adapter.js");
const {completeVerifiedMediaUpload}=require("../api/_lib/media-upload-completion.js");
const asset={assetId:"media-1",businessId:"business-a",kind:"image",state:"pending-upload",contentType:"image/webp",sizeBytes:1234,createdAt:"2026-09-20T09:00:00Z"};
function configured(fn){const old=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;process.env.DEMEOS_MEDIA_UPLOAD_SECRET="01234567890123456789012345678901";return Promise.resolve().then(fn).finally(()=>{if(old===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=old;});}
test("only a verified stored object can move pending media to processing",()=>configured(async()=>{
 const now=Date.parse("2026-09-20T09:01:00Z"),session=createMediaUploadSession({...asset,now}),key=storageKeyFor(asset);
 const adapter=createMediaStorageAdapter({async createUpload(){return null;},async verifyUpload(){return{exists:true,storageKey:key,contentType:"image/webp",sizeBytes:1234,etag:"etag-1"};}});
 const completed=await completeVerifiedMediaUpload({asset,businessId:"business-a",assetId:"media-1",uploadToken:session.uploadToken,storageKey:key,storageAdapter:adapter,now});
 assert.equal(completed.state,"processing");assert.equal(completed.storageKey,key);assert.equal(completed.etag,"etag-1");
}));
test("completion fails closed for wrong business expired token or storage mismatch",()=>configured(async()=>{
 const now=Date.parse("2026-09-20T09:01:00Z"),session=createMediaUploadSession({...asset,now}),key=storageKeyFor(asset);
 const good=createMediaStorageAdapter({async createUpload(){return null;},async verifyUpload(){return{exists:true,storageKey:key,contentType:"image/webp",sizeBytes:1234};}});
 assert.equal(await completeVerifiedMediaUpload({asset,businessId:"business-b",assetId:"media-1",uploadToken:session.uploadToken,storageKey:key,storageAdapter:good,now}),null);
 assert.equal(await completeVerifiedMediaUpload({asset,businessId:"business-a",assetId:"media-1",uploadToken:session.uploadToken,storageKey:key,storageAdapter:good,now:now+16*60*1000}),null);
 const bad=createMediaStorageAdapter({async createUpload(){return null;},async verifyUpload(){return{exists:true,storageKey:key,contentType:"image/png",sizeBytes:1234};}});
 assert.equal(await completeVerifiedMediaUpload({asset,businessId:"business-a",assetId:"media-1",uploadToken:session.uploadToken,storageKey:key,storageAdapter:bad,now}),null);
}));
