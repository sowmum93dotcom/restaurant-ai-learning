const {processNextMediaJob,reconcileMediaProcessingQueue}=require("./media-processing-queue.js");
const {createMediaProcessor}=require("./media-processor.js");
function createMediaWorker({repository,drivers,createProcessingRead,createProcessingWrite,verifyProcessedOutput,maxAttempts=5,reconcileLimit=50}={}){
 const baseProcessor=createMediaProcessor(drivers||{});
 const processor=async(asset,context)=>{
  if(typeof createProcessingRead!=="function")return baseProcessor(asset,context);
  const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
  const delegated=await createProcessingRead({storageKey:asset.storageKey,expiresAt});
  if(!delegated||!delegated.readUrl)throw new Error("Private media source could not be delegated for processing.");
  let outputDestinations;
  if(typeof createProcessingWrite==="function"){
   const contentType=asset.kind==="image"?"image/webp":"video/mp4";
   const roles=asset.kind==="image"?["master","thumbnail","customer","marketing"]:["master","customer","marketing"];
   outputDestinations=[];
   for(const role of roles){
    const storageKey=["businesses",encodeURIComponent(asset.businessId),"media",encodeURIComponent(asset.assetId),"processed",role+(asset.kind==="image"?".webp":".mp4")].join("/");
    const maximumSizeInBytes=asset.kind==="image"?15*1024*1024:250*1024*1024;
    const destination=await createProcessingWrite({storageKey,contentType,maximumSizeInBytes,expiresAt});
    if(!destination||!destination.uploadUrl)throw new Error("Private media output could not be delegated for processing.");
    outputDestinations.push({role,storageKey:destination.storageKey,uploadUrl:destination.uploadUrl,contentType});
   }
  }
  const result=await baseProcessor(asset,{...(context||{}),sourceUrl:delegated.readUrl,sourceExpiresAt:delegated.expiresAt||expiresAt,...(outputDestinations?{outputDestinations}:{})});
  if(!result||!result.success||!outputDestinations||typeof verifyProcessedOutput!=="function")return result;
  for(const expected of outputDestinations){
   const stored=await verifyProcessedOutput({storageKey:expected.storageKey});
   if(!stored||!stored.exists||stored.storageKey!==expected.storageKey||stored.contentType!==expected.contentType)return{success:false,error:"Processed media output verification failed."};
  }
  return result;
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
