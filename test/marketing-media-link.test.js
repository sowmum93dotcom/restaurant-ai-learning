const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeMarketingMediaLinks,resolveApprovedMarketingMedia}=require("../api/_lib/marketing-media-link.js");
const ready={assetId:"a1",businessId:"b1",kind:"image",state:"ready",deliveryUrl:"https://cdn.example/a.webp",width:1200,height:900};
test("marketing work links only ready media owned by the exact business",function(){
 assert.deepEqual(normalizeMarketingMediaLinks([{assetId:"a1",role:"primary"}],"b1",[ready]),[{assetId:"a1",role:"primary"}]);
 assert.equal(normalizeMarketingMediaLinks([{assetId:"a1",role:"primary"}],"b2",[ready]),null);
 assert.equal(normalizeMarketingMediaLinks([{assetId:"a2",role:"primary"}],"b1",[ready]),null);
 assert.equal(normalizeMarketingMediaLinks([{assetId:"a1",role:"primary"}],"b1",[{...ready,state:"processing"}]),null);
});
test("marketing work has at most one primary media asset and no duplicate asset links",function(){
 assert.equal(normalizeMarketingMediaLinks([{assetId:"a1",role:"primary"},{assetId:"a1",role:"supporting"}],"b1",[ready]),null);
 assert.equal(normalizeMarketingMediaLinks([{assetId:"a1",role:"primary"},{assetId:"a2",role:"primary"}],"b1",[ready,{...ready,assetId:"a2"}]),null);
});
test("customer facing media resolves only after owner approval",function(){
 const campaign={approvalStatus:"Unapproved",media:[{assetId:"a1",role:"primary"}]};
 assert.deepEqual(resolveApprovedMarketingMedia(campaign,"b1",[ready]),[]);
 const published=resolveApprovedMarketingMedia({...campaign,approvalStatus:"Approved"},"b1",[ready]);
 assert.equal(published.length,1);assert.equal(published[0].deliveryUrl,"https://cdn.example/a.webp");
});
