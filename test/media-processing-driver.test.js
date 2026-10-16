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

test('Sharp keeps its real image processing when approved HTTP video delegation is added',async()=>{
 const {getConfiguredMediaProcessingDrivers}=require('../api/_lib/media-processing-driver');
 const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({width:640,height:360,durationSeconds:12,contentType:'video/mp4'})};};
 const imageOnly=getConfiguredMediaProcessingDrivers({DEMEOS_MEDIA_PROCESSING_PROVIDER:'sharp'},fetchImpl);
 assert.equal(typeof imageOnly.inspectImage,'function');assert.equal(imageOnly.inspectVideo,undefined);
 const drivers=getConfiguredMediaProcessingDrivers({DEMEOS_MEDIA_PROCESSING_PROVIDER:'sharp',DEMEOS_MEDIA_PROCESSING_URL:'https://processor.example',DEMEOS_MEDIA_PROCESSING_TOKEN:'server-only-fixture'},fetchImpl);
 assert.equal(typeof drivers.optimizeImage,'function');assert.equal(typeof drivers.transcodeVideo,'function');
 const asset={assetId:'media-video',businessId:'shop',storageKey:'private-original',contentType:'video/mp4'};
 const result=await drivers.inspectVideo(asset,{sourceUrl:'https://private.example/source',sourceExpiresAt:'2030-01-01T00:00:00Z'});
 assert.equal(result.durationSeconds,12);assert.equal(calls[0].url,'https://processor.example/inspect/video');assert.equal(calls[0].options.headers.authorization,'Bearer server-only-fixture');
 assert.equal(JSON.parse(calls[0].options.body).sourceUrl,'https://private.example/source');
});
