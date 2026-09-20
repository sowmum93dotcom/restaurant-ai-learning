const {getRepository}=require("./_lib/persistence.js");
const {authorizeMediaWorker}=require("./_lib/media-worker-authorization.js");
const {createMediaWorker}=require("./_lib/media-worker.js");
const {getConfiguredMediaProcessingDrivers}=require("./_lib/media-processing-driver.js");
const {createVercelBlobStorageDriver}=require("./_lib/media-storage-driver.js");
function getDrivers(){return getConfiguredMediaProcessingDrivers();}
module.exports=async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Method not allowed"});}
 if(!authorizeMediaWorker(req))return res.status(401).json({error:"Unauthorized."});
 const drivers=getDrivers();
 if(!drivers)return res.status(503).json({error:"Media processing drivers are not configured."});
 try{
  const storage=process.env.DEMEOS_MEDIA_STORAGE_PROVIDER==="vercel-blob"?createVercelBlobStorageDriver({token:process.env.BLOB_READ_WRITE_TOKEN}):null;
  const worker=createMediaWorker({repository:getRepository(),drivers,createProcessingRead:storage&&storage.createProcessingRead,maxAttempts:5,reconcileLimit:50});
  const result=await worker();
  return res.status(result.status==="not-configured"?503:200).json({status:result.status,recovered:result.recovered,
   ...(result.processed?{job:{jobId:result.processed.jobId,assetId:result.processed.assetId,status:result.processed.status}}:{})});
 }catch(error){console.error("Media worker execution failed:",error);return res.status(500).json({error:"Media worker execution failed."});}
};
module.exports.getDrivers=getDrivers;
