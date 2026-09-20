const test=require("node:test"),assert=require("node:assert/strict");
const {getConfiguredMediaStorageAdapter,getMediaStorageConfiguration}=require("../api/_lib/media-storage-driver.js");
test("storage provider strategy is explicit and fails closed for unsupported providers",()=>{
 assert.equal(getConfiguredMediaStorageAdapter({DEMEOS_MEDIA_STORAGE_PROVIDER:"unsupported",DEMEOS_MEDIA_STORAGE_URL:"https://x",DEMEOS_MEDIA_STORAGE_TOKEN:"t"},async()=>{}),null);
 assert.deepEqual(getMediaStorageConfiguration({DEMEOS_MEDIA_STORAGE_PROVIDER:"http",DEMEOS_MEDIA_STORAGE_URL:"https://x",DEMEOS_MEDIA_STORAGE_TOKEN:"t"}),{provider:"http",configured:true});
});
test("default HTTP storage remains unconfigured without both server credentials",()=>{
 assert.deepEqual(getMediaStorageConfiguration({}),{provider:"http",configured:false});
 assert.equal(getConfiguredMediaStorageAdapter({},async()=>{}),null);
});
