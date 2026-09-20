const test=require("node:test"),assert=require("node:assert/strict");
const {createVercelBlobStorageDriver}=require("../api/_lib/media-storage-driver.js");
test("private source media can be delegated to a processor with a short lived exact GET URL",async()=>{
 let issued,signed;const sdk={issueSignedToken:async o=>(issued=o,{delegationToken:"d",clientSigningToken:"c"}),presignUrl:async(t,o)=>(signed=o,{presignedUrl:"https://blob.example/private-read"})};
 const d=createVercelBlobStorageDriver({token:"server-secret",blobSdkLoader:async()=>sdk});const expiresAt=new Date(Date.now()+300000).toISOString();
 const r=await d.createProcessingRead({storageKey:"businesses/b/media/a/original",expiresAt});
 assert.equal(r.readUrl,"https://blob.example/private-read");assert.deepEqual(issued.operations,["get"]);assert.equal(issued.pathname,"businesses/b/media/a/original");
 assert.equal(signed.operation,"get");assert.equal(signed.access,"private");assert.equal(signed.useCache,false);assert.equal(r.expiresAt,expiresAt);
});
test("processing read fails closed for expired delegation",async()=>{
 const d=createVercelBlobStorageDriver({token:"server-secret",blobSdkLoader:async()=>({})});
 assert.equal(await d.createProcessingRead({storageKey:"k",expiresAt:new Date(Date.now()-1).toISOString()}),null);
});
