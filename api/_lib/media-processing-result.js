const { normalizeMediaDerivatives }=require("./media-derivative-contract.js");
const { normalizeMediaAsset }=require("./media-asset-contract.js");
function normalizeProcessingResult(asset,result){
 if(!asset||asset.state!=="processing"||!result||result.success!==true)return null;
 const deliveryUrl=typeof result.deliveryUrl==="string"?result.deliveryUrl.trim():"";
 const processedStorageKey=typeof result.storageKey==="string"?result.storageKey.trim():"";
 if(!processedStorageKey||!/^https:\/\//i.test(deliveryUrl))return null;
 const updates={deliveryUrl,processedStorageKey};
 for(const key of ["width","height","durationSeconds"]){if(result[key]!==undefined)updates[key]=result[key];}
 const candidate=normalizeMediaAsset({...asset,...updates,state:"processing"},asset.businessId);
 if(!candidate)return null;
 if(asset.kind==="image"&&(!candidate.width||!candidate.height))return null;
 if(asset.kind==="video"&&(!candidate.width||!candidate.height||!candidate.durationSeconds))return null;
 const derivatives=result.derivatives===undefined?[]:normalizeMediaDerivatives(asset,result.derivatives);
 if(result.derivatives!==undefined&&!derivatives)return null;
 return {...updates,...(derivatives&&derivatives.length?{derivatives}:{})};
}
module.exports={normalizeProcessingResult};
