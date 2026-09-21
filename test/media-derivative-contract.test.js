const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeMediaDerivatives}=require("../api/_lib/media-derivative-contract.js");
const {normalizeProcessingResult}=require("../api/_lib/media-processing-result.js");
const image={assetId:"a1",businessId:"b1",kind:"image",state:"processing",contentType:"image/webp"};
test("image derivatives preserve distinct customer marketing and thumbnail roles",function(){
 const d=normalizeMediaDerivatives(image,[
  {role:"thumbnail",storageKey:"businesses/b1/media/a1/processed/thumbnail.webp",deliveryUrl:"https://cdn.example/t.webp",width:320,height:240},
  {role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",deliveryUrl:"https://cdn.example/c.webp",width:1200,height:900},
  {role:"marketing",storageKey:"businesses/b1/media/a1/processed/marketing.webp",deliveryUrl:"https://cdn.example/m.webp",width:1600,height:1200}
 ]);assert.equal(d.length,3);assert.deepEqual(d.map(x=>x.role),["thumbnail","customer","marketing"]);
});
test("derivatives reject duplicate roles insecure delivery and invalid video metadata",function(){
 assert.equal(normalizeMediaDerivatives(image,[{role:"customer",storageKey:"a",deliveryUrl:"https://cdn.example/a",width:10,height:10},{role:"customer",storageKey:"b",deliveryUrl:"https://cdn.example/b",width:20,height:20}]),null);
 assert.equal(normalizeMediaDerivatives(image,[{role:"customer",storageKey:"a",deliveryUrl:"http://cdn.example/a",width:10,height:10}]),null);
 const video={...image,kind:"video",contentType:"video/mp4"};
 assert.equal(normalizeMediaDerivatives(video,[{role:"marketing",storageKey:"v",deliveryUrl:"https://cdn.example/v.mp4",width:1080,height:1920}]),null);
});
test("processing result carries validated derivatives into ready asset updates",function(){
 const out=normalizeProcessingResult(image,{success:true,storageKey:"businesses/b1/media/a1/processed/master.webp",deliveryUrl:"https://cdn.example/master.webp",width:1600,height:1200,
  derivatives:[{role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",deliveryUrl:"https://cdn.example/customer.webp",width:1200,height:900}]});
 assert.equal(out.derivatives[0].role,"customer");assert.equal(out.derivatives[0].deliveryUrl,"https://cdn.example/customer.webp");
});

test("processed storage identities remain private in public media contract",function(){
 const {toPublicMediaAsset}=require("../api/_lib/media-asset-contract.js");
 const ready={assetId:"a1",businessId:"b1",kind:"image",state:"ready",contentType:"image/webp",processedStorageKey:"businesses/b1/media/a1/processed/master.webp",deliveryUrl:"https://cdn.example/master.webp",width:1600,height:1200,derivatives:[{role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",deliveryUrl:"https://cdn.example/customer.webp",contentType:"image/webp",width:1200,height:900}]};
 const out=toPublicMediaAsset(ready,"b1");assert.equal("processedStorageKey" in out,false);assert.equal("storageKey" in out.derivatives[0],false);
});
