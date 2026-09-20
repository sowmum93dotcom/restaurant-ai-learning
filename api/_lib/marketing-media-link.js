const {toPublicMediaAsset}=require("./media-asset-contract.js");
function normalizeMarketingMediaLinks(links,businessId,assets){
 if(links===undefined)return [];
 if(!Array.isArray(links))return null;
 const byId=new Map((Array.isArray(assets)?assets:[]).filter(a=>a&&a.businessId===businessId).map(a=>[a.assetId,a]));
 const seen=new Set(),out=[];
 for(const link of links){
  const assetId=link&&typeof link.assetId==="string"?link.assetId.trim():"";
  const role=link&&typeof link.role==="string"?link.role.trim():"";
  if(!assetId||seen.has(assetId)||!["primary","supporting"].includes(role))return null;
  const asset=byId.get(assetId),publicAsset=toPublicMediaAsset(asset,businessId);
  if(!publicAsset)return null;
  seen.add(assetId);out.push({assetId,role});
 }
 if(out.filter(x=>x.role==="primary").length>1)return null;
 return out;
}
function resolveApprovedMarketingMedia(campaign,businessId,assets){
 if(!campaign||campaign.approvalStatus!=="Approved")return [];
 const links=normalizeMarketingMediaLinks(campaign.media,businessId,assets);if(!links)return [];
 const byId=new Map(assets.map(a=>[a.assetId,a]));
 return links.map(link=>({...link,...toPublicMediaAsset(byId.get(link.assetId),businessId)}));
}
module.exports={normalizeMarketingMediaLinks,resolveApprovedMarketingMedia};
