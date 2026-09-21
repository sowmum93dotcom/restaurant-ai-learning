const test=require("node:test"),assert=require("node:assert/strict");
const {createVercelBlobStorageDriver}=require("../api/_lib/media-storage-driver.js");
test("private processed media receives a short lived read capability without exposing storage credentials",async()=>{
 const calls=[];const sdk={
  async issueSignedToken(o){calls.push(["token",o]);return"delegated-token";},
  async presignUrl(token,o){calls.push(["presign",token,o]);return{presignedUrl:"https://blob.example/private-read"};}
 };
 const driver=createVercelBlobStorageDriver({token:"permanent-secret",blobSdkLoader:async()=>sdk});
 const expiresAt=new Date(Date.now()+60000).toISOString();
 const out=await driver.createDeliveryRead({storageKey:"businesses/b1/media/a1/processed/customer.webp",expiresAt});
 assert.equal(out.storageKey,"businesses/b1/media/a1/processed/customer.webp");
 assert.equal(out.deliveryUrl,"https://blob.example/private-read");assert.equal(out.expiresAt,expiresAt);
 assert.equal(calls[0][1].operations[0],"get");assert.equal(calls[1][2].access,"private");
 assert.doesNotMatch(JSON.stringify(out),/permanent-secret/);
});
test("private delivery fails closed for expired or missing storage identity",async()=>{
 const driver=createVercelBlobStorageDriver({token:"secret",blobSdkLoader:async()=>({})});
 assert.equal(await driver.createDeliveryRead({storageKey:"",expiresAt:new Date(Date.now()+60000).toISOString()}),null);
 assert.equal(await driver.createDeliveryRead({storageKey:"businesses/b1/media/a1/processed/customer.webp",expiresAt:"2020-01-01T00:00:00Z"}),null);
});
