const test=require("node:test"),assert=require("node:assert/strict");
const {createHttpObjectStorageDriver,getConfiguredMediaStorageAdapter}=require("../api/_lib/media-storage-driver.js");
function response({ok=true,json={},headers={}}={}){return{ok,json:async()=>json,headers:{get:k=>headers[k.toLowerCase()]||null}};}
test("storage driver creates controlled upload URL without exposing storage token",async()=>{
 let request;const driver=createHttpObjectStorageDriver({baseUrl:"https://storage.example/objects",token:"secret",fetchImpl:async(u,o)=>{request={u,o};return response({json:{uploadUrl:"https://upload.example/signed"}});}});
 const r=await driver.createUpload({storageKey:"businesses/b 1/media/a1/original",contentType:"image/webp",sizeBytes:100,expiresAt:"soon"});
 assert.equal(r.uploadUrl,"https://upload.example/signed");assert.match(request.u,/businesses\/b%201\/media\/a1\/original/);assert.equal(request.o.headers.authorization,"Bearer secret");assert.doesNotMatch(JSON.stringify(r),/secret/);
});
test("storage driver verifies actual stored object metadata",async()=>{
 const driver=createHttpObjectStorageDriver({baseUrl:"https://storage.example",token:"secret",fetchImpl:async()=>response({headers:{"content-type":"video/mp4","content-length":"2048","etag":"\"abc\""}})});
 const r=await driver.verifyUpload({storageKey:"businesses/b/media/v/original"});assert.equal(r.exists,true);assert.equal(r.contentType,"video/mp4");assert.equal(r.sizeBytes,2048);assert.equal(r.etag,"abc");
});
test("configured adapter fails closed without secure storage configuration",()=>{
 assert.equal(getConfiguredMediaStorageAdapter({},async()=>{}),null);assert.equal(createHttpObjectStorageDriver({baseUrl:"http://unsafe",token:"x",fetchImpl:async()=>{}}),null);
});
