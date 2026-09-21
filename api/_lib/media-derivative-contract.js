const { normalizeMediaAsset }=require("./media-asset-contract.js");
const MEDIA_DERIVATIVE_ROLES=Object.freeze(["thumbnail","customer","marketing"]);
function normalizeMediaDerivative(asset,derivative){
 if(!asset||asset.state!=="processing"||!derivative||typeof derivative!=="object")return null;
 const role=typeof derivative.role==="string"?derivative.role.trim():"";
 const deliveryUrl=typeof derivative.deliveryUrl==="string"?derivative.deliveryUrl.trim():"";
 const storageKey=typeof derivative.storageKey==="string"?derivative.storageKey.trim():"";
 if(!MEDIA_DERIVATIVE_ROLES.includes(role)||!storageKey||!/^https:\/\//i.test(deliveryUrl))return null;
 const candidate=normalizeMediaAsset({...asset,state:"processing",deliveryUrl,
   contentType:derivative.contentType||asset.contentType,width:derivative.width,height:derivative.height,
   durationSeconds:derivative.durationSeconds},asset.businessId);
 if(!candidate)return null;
 if(asset.kind==="image"&&(!candidate.width||!candidate.height))return null;
 if(asset.kind==="video"&&(!candidate.width||!candidate.height||!candidate.durationSeconds))return null;
 return {role,storageKey,deliveryUrl,...(candidate.contentType?{contentType:candidate.contentType}:{}),
   width:candidate.width,height:candidate.height,...(candidate.durationSeconds?{durationSeconds:candidate.durationSeconds}:{})};
}
function normalizeMediaDerivatives(asset,items){
 if(!Array.isArray(items)||!items.length)return null;
 const seen=new Set(),out=[];
 for(const item of items){const d=normalizeMediaDerivative(asset,item);if(!d||seen.has(d.role))return null;seen.add(d.role);out.push(d);}
 return out;
}
module.exports={MEDIA_DERIVATIVE_ROLES,normalizeMediaDerivative,normalizeMediaDerivatives};
