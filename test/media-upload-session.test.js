const test=require("node:test"),assert=require("node:assert/strict");
const {createMediaUploadSession,verifyMediaUploadToken,UPLOAD_SESSION_TTL_SECONDS}=require("../api/_lib/media-upload-session.js");
test("media upload sessions are short lived and bound to business asset type and size",function(){
 const old=process.env.DEMEOS_MEDIA_UPLOAD_SECRET; process.env.DEMEOS_MEDIA_UPLOAD_SECRET="01234567890123456789012345678901";
 try{
  const now=Date.parse("2026-09-20T09:00:00Z");
  const s=createMediaUploadSession({businessId:"business-a",assetId:"media-1",contentType:"image/webp",sizeBytes:1234,now});
  assert.equal(Date.parse(s.expiresAt),now+UPLOAD_SESSION_TTL_SECONDS*1000);
  assert.deepEqual(verifyMediaUploadToken(s.uploadToken,{businessId:"business-a",assetId:"media-1",now}),{
   businessId:"business-a",assetId:"media-1",contentType:"image/webp",sizeBytes:1234,expiresAt:s.expiresAt});
  assert.equal(verifyMediaUploadToken(s.uploadToken,{businessId:"business-b",assetId:"media-1",now}),null);
  assert.equal(verifyMediaUploadToken(s.uploadToken,{businessId:"business-a",assetId:"media-2",now}),null);
  assert.equal(verifyMediaUploadToken(s.uploadToken,{businessId:"business-a",assetId:"media-1",now:Date.parse(s.expiresAt)}),null);
 }finally{if(old===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=old;}
});
test("upload sessions fail closed when server storage signing is not configured",function(){
 const old=process.env.DEMEOS_MEDIA_UPLOAD_SECRET; delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
 try{assert.equal(createMediaUploadSession({businessId:"b",assetId:"a"}),null);}
 finally{if(old!==undefined)process.env.DEMEOS_MEDIA_UPLOAD_SECRET=old;}
});
