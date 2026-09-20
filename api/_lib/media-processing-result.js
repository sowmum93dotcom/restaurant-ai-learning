const { normalizeMediaAsset }=require("./media-asset-contract.js");
function normalizeProcessingResult(asset,result){
 if(!asset||asset.state!=="processing"||!result||result.success!==true)return null;
 const deliveryUrl=typeof result.deliveryUrl==="string"?result.deliveryUrl.trim():"";
 if(!/^https:\/\//i.test(deliveryUrl))return null;
 const updates={deliveryUrl};
 for(const key of ["width","height","durationSeconds"]){if(result[key]!==undefined)updates[key]=result[key];}
 const candidate=normalizeMediaAsset({...asset,...updates,state:"processing"},asset.businessId);
 if(!candidate)return null;
 if(asset.kind==="image"&&(!candidate.width||!candidate.height))return null;
 if(asset.kind==="video"&&(!candidate.width||!candidate.height||!candidate.durationSeconds))return null;
 return updates;
}
module.exports={normalizeProcessingResult};
