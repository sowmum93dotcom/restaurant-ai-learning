const test=require("node:test"),assert=require("node:assert/strict");
const {getConfiguredMediaProcessingDrivers,getMediaProcessingConfiguration}=require("../api/_lib/media-processing-driver.js");
test("processing provider strategy fails closed for unsupported providers",()=>{
 assert.equal(getConfiguredMediaProcessingDrivers({DEMEOS_MEDIA_PROCESSING_PROVIDER:"unsupported",DEMEOS_MEDIA_PROCESSING_URL:"https://x",DEMEOS_MEDIA_PROCESSING_TOKEN:"t"},async()=>{}),null);
 assert.deepEqual(getMediaProcessingConfiguration({DEMEOS_MEDIA_PROCESSING_PROVIDER:"http",DEMEOS_MEDIA_PROCESSING_URL:"https://x",DEMEOS_MEDIA_PROCESSING_TOKEN:"t"}),{provider:"http",configured:true});
});
test("processing is unconfigured without endpoint and credential",()=>{
 assert.deepEqual(getMediaProcessingConfiguration({}),{provider:"http",configured:false});
 assert.equal(getConfiguredMediaProcessingDrivers({},async()=>{}),null);
});
