const {processNextMediaJob,reconcileMediaProcessingQueue}=require("./media-processing-queue.js");
const {createMediaProcessor}=require("./media-processor.js");
function createMediaWorker({repository,drivers,maxAttempts=5,reconcileLimit=50}={}){
 const processor=createMediaProcessor(drivers||{});
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
