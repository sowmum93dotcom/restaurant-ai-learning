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
 assert.deepEqual(r.headers,{"x-content-type":"video/mp4","x-vercel-blob-access":"private"});assert.equal(signed.access,"private");assert.equal(signed.addRandomSuffix,false);assert.equal(signed.allowOverwrite,false);
});
test("Vercel Blob verification returns trusted metadata",async()=>{
 const sdk={head:async(path,o)=>({contentType:"image/webp",size:44,etag:"etag1"})};
 const d=createVercelBlobStorageDriver({token:"server-secret",blobSdkLoader:async()=>sdk});
 assert.deepEqual(await d.verifyUpload({storageKey:"businesses/b/media/a/original"}),{exists:true,storageKey:"businesses/b/media/a/original",contentType:"image/webp",sizeBytes:44,etag:"etag1"});
});
test("Vercel Blob provider requires server token",()=>{assert.deepEqual(getMediaStorageConfiguration({DEMEOS_MEDIA_STORAGE_PROVIDER:"vercel-blob",BLOB_READ_WRITE_TOKEN:"x"}),{provider:"vercel-blob",configured:true});assert.equal(createVercelBlobStorageDriver({}),null);});
test('Blob upload headers survive the adapter and private processing output delegation',async()=>{
 const sdk={issueSignedToken:async()=>({delegationToken:'fixture',clientSigningToken:'fixture'}),presignUrl:async()=>({presignedUrl:'https://blob.example/put'}),head:async()=>({})};
 const driver=createVercelBlobStorageDriver({token:'fixture-token',blobSdkLoader:async()=>sdk});
 const adapter=require('../api/_lib/media-storage-adapter').createMediaStorageAdapter(driver);
 const asset={businessId:'b',assetId:'media-1',kind:'image',contentType:'image/png',sizeBytes:20},expiresAt=new Date(Date.now()+60000).toISOString();
 const upload=await adapter.createUpload(asset,{expiresAt});assert.deepEqual(upload.headers,{'x-content-type':'image/png','x-vercel-blob-access':'private'});
 const output=await driver.createProcessingWrite({storageKey:'businesses/b/media/media-1/processed/master.webp',contentType:'image/webp',maximumSizeInBytes:100,expiresAt});
 assert.deepEqual(output.headers,{'x-content-type':'image/webp','x-vercel-blob-access':'private'});
 assert.doesNotMatch(JSON.stringify(upload),/fixture-token/);
});
