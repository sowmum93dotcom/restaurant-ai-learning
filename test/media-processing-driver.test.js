const test=require("node:test"),assert=require("node:assert/strict");
const {createHttpMediaProcessingDrivers,getConfiguredMediaProcessingDrivers}=require("../api/_lib/media-processing-driver.js");
const asset={assetId:"a1",businessId:"b1",storageKey:"businesses/b1/media/a1/original",contentType:"image/jpeg"};
test("processing drivers fail closed without secure configuration",()=>{assert.equal(getConfiguredMediaProcessingDrivers({},async()=>{}),null);});
test("processing driver keeps provider token server side and binds business asset source",async()=>{
 let request;const fetchImpl=async(url,options)=>{request={url,options};return{ok:true,json:async()=>({contentType:"image/jpeg",width:1200,height:800})};};
 const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example",token:"secret",fetchImpl});
 const result=await d.inspectImage(asset,{jobId:7});assert.equal(result.width,1200);
 assert.equal(request.url,"https://processor.example/inspect/image");assert.equal(request.options.headers.authorization,"Bearer secret");
 const body=JSON.parse(request.options.body);assert.equal(body.businessId,"b1");assert.equal(body.assetId,"a1");assert.equal(body.storageKey,asset.storageKey);
 assert.equal(JSON.stringify(body).includes("secret"),false);
});
test("processing driver exposes distinct image optimization and video transcode operations",async()=>{
 const calls=[];const fetchImpl=async(url)=>{calls.push(url);return{ok:true,json:async()=>({})};};
 const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example/",token:"secret",fetchImpl});
 await d.optimizeImage(asset,{width:1200,height:800},{});await d.transcodeVideo({...asset,contentType:"video/mp4"},{width:1280,height:720,durationSeconds:20},{});
 assert.match(calls[0],/\/optimize\/image$/);assert.match(calls[1],/\/transcode\/video$/);
});

test("processing driver sends only validated temporary output capabilities",async()=>{
 let body;const fetchImpl=async(url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({})};};
 const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example",token:"permanent-processor-secret",fetchImpl});
 await d.optimizeImage(asset,{width:1200,height:800},{outputDestinations:[{role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",uploadUrl:"https://private.example/temporary-put",contentType:"image/webp",unexpected:"drop-me"}]});
 assert.deepEqual(body.outputDestinations,[{role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",uploadUrl:"https://private.example/temporary-put",contentType:"image/webp"}]);
 assert.equal(JSON.stringify(body).includes("permanent-processor-secret"),false);
});
test("processing driver drops malformed output capability sets",async()=>{
 let body;const fetchImpl=async(url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({})};};
 const d=createHttpMediaProcessingDrivers({baseUrl:"https://processor.example",token:"secret",fetchImpl});
 await d.optimizeImage(asset,{width:1200,height:800},{outputDestinations:[{role:"customer",storageKey:"x",uploadUrl:"http://unsafe.example",contentType:"image/webp"}]});
 assert.equal(body.outputDestinations,undefined);
});
