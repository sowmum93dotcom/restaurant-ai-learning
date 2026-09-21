const test=require("node:test"),assert=require("node:assert/strict");
const {resolveApprovedMarketingMedia,resolveApprovedMarketingMediaForDelivery}=require("../api/_lib/marketing-media-link.js");
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

test("managed customer media receives a short-lived controlled delivery URL",async function(){
 const managed={...asset,processedStorageKey:"businesses/b1/media/a1/processed/master.webp",derivatives:[
  {role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",deliveryUrl:"https://expired.example/customer.webp",contentType:"image/webp",width:1200,height:900}
 ]};let requested;
 const media=await resolveApprovedMarketingMediaForDelivery({approvalStatus:"Approved",media:[{assetId:"a1",role:"primary"}]},"b1",[managed],async input=>{requested=input;return{storageKey:input.storageKey,deliveryUrl:"https://private.example/signed-customer.webp"};});
 assert.equal(requested.storageKey,"businesses/b1/media/a1/processed/customer.webp");assert.equal(media[0].deliveryUrl,"https://private.example/signed-customer.webp");
});
test("managed customer media fails closed when controlled delivery cannot be delegated",async function(){
 const managed={...asset,processedStorageKey:"businesses/b1/media/a1/processed/master.webp",derivatives:[
  {role:"customer",storageKey:"businesses/b1/media/a1/processed/customer.webp",deliveryUrl:"https://expired.example/customer.webp",contentType:"image/webp",width:1200,height:900}
 ]};
 const media=await resolveApprovedMarketingMediaForDelivery({approvalStatus:"Approved",media:[{assetId:"a1",role:"primary"}]},"b1",[managed],async()=>null);
 assert.deepEqual(media,[]);
});

test("customer delivery caps provider calls before delegation and preserves order under concurrency",async()=>{
 const assets=Array.from({length:200},(_,i)=>({...asset,assetId:`a${i}`,derivatives:[],
  processedStorageKey:`businesses/b1/media/a${i}/processed/master.webp`}));
 const campaign={approvalStatus:"Approved",media:assets.map((a,i)=>({assetId:a.assetId,role:i===0?"primary":"supporting"}))};
 const pending=[];
 const result=resolveApprovedMarketingMediaForDelivery(campaign,"b1",assets,input=>new Promise(resolve=>pending.push({input,resolve})));
 // All permitted calls must start without waiting for an earlier provider response.
 assert.equal(pending.length,10);
 for(const {input,resolve} of pending.reverse())resolve({storageKey:input.storageKey,deliveryUrl:`https://private.example/${input.storageKey}`});
 const media=await result;
 assert.deepEqual(media.map(a=>a.assetId),assets.slice(0,10).map(a=>a.assetId));
 assert.equal(toPublicCustomerWorkItem({workItemId:"w1",businessName:"Business",content:"Offer",participationAction:"Interested",media}).media.length,10);
});

test("delivery budget includes external images and does not refill failed private reads",async()=>{
 const assets=Array.from({length:12},(_,i)=>({...asset,assetId:`a${i}`,derivatives:[],
  ...(i===0?{}:{processedStorageKey:`businesses/b1/media/a${i}/processed/master.webp`})}));
 const campaign={approvalStatus:"Approved",media:assets.map((a,i)=>({assetId:a.assetId,role:i===0?"primary":"supporting"}))};
 const calls=[];
 const media=await resolveApprovedMarketingMediaForDelivery(campaign,"b1",assets,async input=>{calls.push(input);return null;});
 assert.equal(calls.length,9);
 assert.deepEqual(media.map(a=>a.assetId),["a0"]);
 campaign.media.push({assetId:"foreign",role:"supporting"});
 assert.deepEqual(await resolveApprovedMarketingMediaForDelivery(campaign,"b1",assets,async()=>{throw Error("must validate all links before delegation");}),[]);
});
