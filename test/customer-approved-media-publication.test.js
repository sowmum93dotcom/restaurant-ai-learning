const test=require("node:test"),assert=require("node:assert/strict");
const {resolveApprovedMarketingMedia}=require("../api/_lib/marketing-media-link.js");
const {toPublicCustomerWorkItem}=require("../api/_lib/customer-public-work-contract.js");
const asset={assetId:"a1",businessId:"b1",kind:"image",state:"ready",deliveryUrl:"https://cdn.example/master.webp",width:1600,height:1200,derivatives:[
 {role:"customer",deliveryUrl:"https://cdn.example/customer.webp",contentType:"image/webp",width:1200,height:900},
 {role:"marketing",deliveryUrl:"https://cdn.example/marketing.webp",contentType:"image/webp",width:1600,height:1200}
]};
test("approved marketing work publishes customer optimized derivative instead of master",function(){
 const media=resolveApprovedMarketingMedia({approvalStatus:"Approved",media:[{assetId:"a1",role:"primary"}]},"b1",[asset]);
 assert.equal(media[0].deliveryUrl,"https://cdn.example/customer.webp");
 assert.notEqual(media[0].deliveryUrl,asset.deliveryUrl);
});
test("unapproved marketing work publishes no media",function(){
 assert.deepEqual(resolveApprovedMarketingMedia({approvalStatus:"Unapproved",media:[{assetId:"a1",role:"primary"}]},"b1",[asset]),[]);
});
test("customer public contract carries only secure approved resolved media fields",function(){
 const item=toPublicCustomerWorkItem({workItemId:"w1",businessName:"Business",content:"Offer",participationAction:"Interested",
  media:[{assetId:"a1",kind:"image",role:"primary",deliveryUrl:"https://cdn.example/customer.webp",contentType:"image/webp"},
   {assetId:"bad",kind:"image",role:"supporting",deliveryUrl:"http://unsafe.example/x"}]});
 assert.equal(item.media.length,1);assert.deepEqual(item.media[0],{assetId:"a1",kind:"image",role:"primary",deliveryUrl:"https://cdn.example/customer.webp",contentType:"image/webp"});
});

test("managed media publishes only derivatives belonging to its controlled DEMEOS storage identity",function(){
 const managed={...asset,processedStorageKey:"businesses/b1/media/a1/processed/master.webp",derivatives:[
  {role:"customer",storageKey:"businesses/other/media/x/processed/customer.webp",deliveryUrl:"https://cdn.example/wrong.webp",contentType:"image/webp",width:1200,height:900},
  {role:"marketing",storageKey:"businesses/b1/media/a1/processed/marketing.webp",deliveryUrl:"https://cdn.example/marketing.webp",contentType:"image/webp",width:1600,height:1200}
 ]};
 const media=resolveApprovedMarketingMedia({approvalStatus:"Approved",media:[{assetId:"a1",role:"primary"}]},"b1",[managed]);
 assert.equal(media[0].deliveryUrl,"https://cdn.example/marketing.webp");
});
test("managed media with a foreign processed master identity fails closed",function(){
 const managed={...asset,processedStorageKey:"businesses/other/media/a1/processed/master.webp"};
 assert.deepEqual(resolveApprovedMarketingMedia({approvalStatus:"Approved",media:[{assetId:"a1",role:"primary"}]},"b1",[managed]),[]);
});
