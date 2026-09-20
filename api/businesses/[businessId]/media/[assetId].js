const { getRepository }=require("../../../../_lib/persistence.js");
const { authorizeBusinessOwnerRequest }=require("../../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS }=require("../../../../_lib/demeos-rules.js");
const { transitionMediaAsset }=require("../../../../_lib/media-processing-lifecycle.js");
const { completeVerifiedMediaUpload }=require("../../../../_lib/media-upload-completion.js");
const { getConfiguredMediaStorageAdapter }=require("../../../../_lib/media-storage-driver.js");
const { enqueueVerifiedMediaForProcessing }=require("../../../../_lib/media-processing-queue.js");
module.exports=async function handler(req,res){
 if(req.method!=="PATCH"){res.setHeader("Allow","PATCH");return res.status(405).json({error:"Method not allowed"});}
 const businessId=typeof req.query.businessId==="string"?req.query.businessId.trim():"";
 const assetId=typeof req.query.assetId==="string"?req.query.assetId.trim():"";
 if(!businessId||!assetId)return res.status(400).json({error:"A businessId and assetId are required."});
 try{
  const repository=getRepository();
  const access=await authorizeBusinessOwnerRequest({req,businessId,action:DEMEOS_ACTIONS.MANAGE_BUSINESS_MEDIA,repository});
  if(!access.authenticated)return res.status(401).json({error:"Authentication required."});
  if(!access.allowed)return res.status(403).json({error:"Forbidden."});
  const current=await repository.getBusinessMediaAsset(businessId,assetId);
  if(!current)return res.status(404).json({error:"Media asset not found."});
  if(req.body&&req.body.action==="complete-upload"){
   const storage=getConfiguredMediaStorageAdapter();
   if(!storage)return res.status(503).json({error:"Media storage is not configured."});
   const processing=await completeVerifiedMediaUpload({asset:current,businessId,assetId,
    uploadToken:req.body.uploadToken,storageKey:req.body.storageKey,storageAdapter:storage});
   if(!processing)return res.status(409).json({error:"The uploaded media could not be verified."});
   if(processing.uploadCompletionReplay){\n    const processingStatus=processing.state==="ready"?"completed":"queued";\n    const asset={...processing};delete asset.uploadCompletionReplay;\n    return res.status(200).json({asset,processingStatus,replayed:true});\n   }\n   const handoff=await enqueueVerifiedMediaForProcessing(repository,processing);
   if(!handoff)return res.status(503).json({error:"Media processing could not be queued."});
   return res.status(202).json({asset:handoff.asset||processing,processingStatus:"queued"});
  }
  const nextState=req.body&&req.body.state;
  if(nextState==="processing"||nextState==="ready")return res.status(403).json({error:"Processing states are controlled by DEMEOS."});
  const allowedUpdates={};
  for(const key of ["failureReason"]){if(req.body&&req.body[key]!==undefined)allowedUpdates[key]=req.body[key];}
  const next=transitionMediaAsset(current,businessId,nextState,allowedUpdates);
  if(!next)return res.status(409).json({error:"That media lifecycle transition is not allowed."});
  const saved=await repository.saveBusinessMediaAsset(businessId,next);
  return res.status(200).json({asset:saved});
 }catch(error){console.error("Could not update media lifecycle:",error);return res.status(500).json({error:"DEMEOS could not update media lifecycle."});}
};
