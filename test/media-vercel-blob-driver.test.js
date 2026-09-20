const test=require("node:test"),assert=require("node:assert/strict");
const {createVercelBlobStorageDriver,getMediaStorageConfiguration}=require("../api/_lib/media-storage-driver.js");
test("Vercel Blob driver issues exact private presigned upload constraints",async()=>{
 let issued,signed;
 const sdk={issueSignedToken:async o=>(issued=o,{delegationToken:"d",clientSigningToken:"c"}),presignUrl:async(t,o)=>(signed=o,{presignedUrl:"https://blob.example/upload"}),head:async()=>({})};
 const d=createVercelBlobStorageDriver({token:"server-secret",blobSdkLoader:async()=>sdk});
 const expiresAt=new Date(Date.now()+60000).toISOString();
 const r=await d.createUpload({storageKey:"businesses/b/media/a/original",contentType:"video/mp4",sizeBytes:100,expiresAt});
 assert.equal(r.uploadUrl,"https://blob.example/upload");assert.equal(issued.pathname,"businesses/b/media/a/original");assert.deepEqual(issued.operations,["put"]);
 assert.deepEqual(issued.allowedContentTypes,["video/mp4"]);assert.equal(issued.maximumSizeInBytes,100);assert.equal(issued.token,"server-secret");
 assert.equal(signed.access,"private");assert.equal(signed.addRandomSuffix,false);assert.equal(signed.allowOverwrite,false);
});
test("Vercel Blob verification returns trusted metadata",async()=>{
 const sdk={head:async(path,o)=>({contentType:"image/webp",size:44,etag:"etag1"})};
 const d=createVercelBlobStorageDriver({token:"server-secret",blobSdkLoader:async()=>sdk});
 assert.deepEqual(await d.verifyUpload({storageKey:"businesses/b/media/a/original"}),{exists:true,storageKey:"businesses/b/media/a/original",contentType:"image/webp",sizeBytes:44,etag:"etag1"});
});
test("Vercel Blob provider requires server token",()=>{assert.deepEqual(getMediaStorageConfiguration({DEMEOS_MEDIA_STORAGE_PROVIDER:"vercel-blob",BLOB_READ_WRITE_TOKEN:"x"}),{provider:"vercel-blob",configured:true});assert.equal(createVercelBlobStorageDriver({}),null);});
