async function enqueueVerifiedMediaForProcessing(repository,asset){
 if(!repository||!asset||asset.state!=="processing")return null;
 return repository.enqueueMediaProcessingJob(asset.businessId,asset.assetId);
}
async function processNextMediaJob(repository,processor,{maxAttempts=5}={}){
 if(!repository||typeof processor!=="function")return null;
 const job=await repository.claimNextMediaProcessingJob(maxAttempts); if(!job)return null;
 try{
  const asset=await repository.getBusinessMediaAsset(job.business_id,job.asset_id);
  if(!asset||asset.state!=="processing")throw new Error("Media asset is not available for processing.");
  const result=await processor(asset,{jobId:String(job.job_id),attempt:job.attempts});
  if(!result||result.success!==true)throw new Error(result&&result.error||"Media processor did not complete.");
  await repository.finishMediaProcessingJob(job.job_id,true);
  return {jobId:String(job.job_id),assetId:job.asset_id,businessId:job.business_id,status:"completed",result};
 }catch(error){
  await repository.finishMediaProcessingJob(job.job_id,false,error&&error.message);
  return {jobId:String(job.job_id),assetId:job.asset_id,businessId:job.business_id,status:"failed",error:error&&error.message};
 }
}
module.exports={enqueueVerifiedMediaForProcessing,processNextMediaJob};
