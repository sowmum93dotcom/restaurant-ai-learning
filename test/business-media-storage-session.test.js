const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("business media registration requests direct object storage upload",()=>{
 const source=fs.readFileSync(require.resolve("../api/businesses/[businessId]/media/index.js"),"utf8");
 assert.match(source,/getConfiguredMediaStorageAdapter/);
 assert.match(source,/storage\.createUpload\(saved, uploadSession\)/);
 assert.match(source,/storageKey: storageUpload\.storageKey/);
 assert.match(source,/uploadUrl: storageUpload\.uploadUrl/);
});
test("business media response keeps provider credentials server side",()=>{
 const source=fs.readFileSync(require.resolve("../api/businesses/[businessId]/media/index.js"),"utf8");
 const response=source.slice(source.indexOf("return res.status(201)"));
 assert.doesNotMatch(response,/MEDIA_STORAGE_TOKEN/);
 assert.doesNotMatch(response,/authorization:/i);
});
