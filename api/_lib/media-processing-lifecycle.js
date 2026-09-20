const { normalizeMediaAsset } = require("./media-asset-contract.js");
const MEDIA_TRANSITIONS=Object.freeze({
  "pending-upload":Object.freeze(["processing","failed","archived"]),
  processing:Object.freeze(["ready","failed","archived"]),
  ready:Object.freeze(["archived"]),
  failed:Object.freeze(["pending-upload","archived"]),
  archived:Object.freeze([])
});
function transitionMediaAsset(asset,businessId,nextState,updates={},now=new Date().toISOString()){
 const current=normalizeMediaAsset(asset,businessId);
 if(!current||!MEDIA_TRANSITIONS[current.state]||!MEDIA_TRANSITIONS[current.state].includes(nextState))return null;
 const candidate={...current,...updates,assetId:current.assetId,businessId:current.businessId,kind:current.kind,state:nextState,
   createdAt:current.createdAt,updatedAt:now};
 if(nextState==="ready"&&!(typeof candidate.deliveryUrl==="string"&&candidate.deliveryUrl.startsWith("https://")))return null;
 if(nextState==="failed"){
   const failureReason=typeof updates.failureReason==="string"&&updates.failureReason.trim()?updates.failureReason.trim():null;
   if(!failureReason)return null; candidate.failureReason=failureReason.slice(0,500);
 }
 return normalizeMediaAsset(candidate,businessId);
}
module.exports={MEDIA_TRANSITIONS,transitionMediaAsset};
