const { getRepository }=require("../../../../_lib/persistence.js");
const { authorizeBusinessOwnerRequest }=require("../../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS }=require("../../../../_lib/demeos-rules.js");
const { transitionMediaAsset }=require("../../../../_lib/media-processing-lifecycle.js");
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
  const nextState=req.body&&req.body.state;
  const allowedUpdates={};
  for(const key of ["deliveryUrl","width","height","durationSeconds","failureReason"]){if(req.body&&req.body[key]!==undefined)allowedUpdates[key]=req.body[key];}
  const next=transitionMediaAsset(current,businessId,nextState,allowedUpdates);
  if(!next)return res.status(409).json({error:"That media lifecycle transition is not allowed."});
  const saved=await repository.saveBusinessMediaAsset(businessId,next);
  return res.status(200).json({asset:saved});
 }catch(error){console.error("Could not update media lifecycle:",error);return res.status(500).json({error:"DEMEOS could not update media lifecycle."});}
};
