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
function selectCustomerMediaVariant(asset){
 const derivatives=Array.isArray(asset&&asset.derivatives)?asset.derivatives:[];
 const managed=Boolean(asset&&asset.processedStorageKey);
 const eligible=d=>d&&(!managed||(typeof d.storageKey==="string"&&d.storageKey.startsWith(`businesses/${asset.businessId}/media/${asset.assetId}/processed/`)));
 return derivatives.find(d=>eligible(d)&&d.role==="customer")||derivatives.find(d=>eligible(d)&&d.role==="marketing")||null;
}
function hasControlledManagedIdentity(asset){
 if(!asset||!asset.processedStorageKey)return true;
 const prefix=`businesses/${asset.businessId}/media/${asset.assetId}/processed/`;
 return asset.processedStorageKey.startsWith(prefix);
}
function resolveApprovedMarketingMedia(campaign,businessId,assets){
 if(!campaign||campaign.approvalStatus!=="Approved")return [];
 const links=normalizeMarketingMediaLinks(campaign.media,businessId,assets);if(!links)return [];
 const byId=new Map(assets.map(a=>[a.assetId,a]));
 const resolved=links.map(function(link){
  const asset=byId.get(link.assetId);if(!hasControlledManagedIdentity(asset))return null;
  const publicAsset=toPublicMediaAsset(asset,businessId),variant=selectCustomerMediaVariant(asset);
  if(!publicAsset)return null;
  if(variant) return {...link,assetId:publicAsset.assetId,kind:publicAsset.kind,deliveryUrl:variant.deliveryUrl,...(variant.contentType?{contentType:variant.contentType}:{})};
  return {...link,...publicAsset};
 });
 return resolved.every(Boolean)?resolved:[];
}
module.exports={normalizeMarketingMediaLinks,resolveApprovedMarketingMedia,selectCustomerMediaVariant};
