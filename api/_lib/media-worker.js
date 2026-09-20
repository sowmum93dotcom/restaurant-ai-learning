const {processNextMediaJob,reconcileMediaProcessingQueue}=require("./media-processing-queue.js");
const {createMediaProcessor}=require("./media-processor.js");
function createMediaWorker({repository,drivers,createProcessingRead,maxAttempts=5,reconcileLimit=50}={}){
 const baseProcessor=createMediaProcessor(drivers||{});
 const processor=async(asset,context)=>{
  if(typeof createProcessingRead!=="function")return baseProcessor(asset,context);
  const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
  const delegated=await createProcessingRead({storageKey:asset.storageKey,expiresAt});
  if(!delegated||!delegated.readUrl)throw new Error("Private media source could not be delegated for processing.");
  return baseProcessor(asset,{...(context||{}),sourceUrl:delegated.readUrl,sourceExpiresAt:delegated.expiresAt||expiresAt});
 };
 return async function runMediaWorker(){
  if(!repository)return{status:"not-configured"};
  const stale=typeof repository.recoverStaleMediaProcessingJobs==="function"
   ?await repository.recoverStaleMediaProcessingJobs(maxAttempts,15,reconcileLimit):[];
  const recovered=await reconcileMediaProcessingQueue(repository,{limit:reconcileLimit});
  const processed=await processNextMediaJob(repository,processor,{maxAttempts});
  return{status:processed?processed.status:"idle",recovered:Array.isArray(recovered)?recovered.length:0,staleRecovered:Array.isArray(stale)?stale.length:0,processed:processed||null};
 };
}
module.exports={createMediaWorker};
