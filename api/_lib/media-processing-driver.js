function clean(v){return typeof v==="string"&&v.trim()?v.trim():null;}
function https(v){return typeof v==="string"&&/^https:\/\//i.test(v);}
function createHttpMediaProcessingDrivers({baseUrl,token,fetchImpl=globalThis.fetch,timeoutMs=30000}={}){
 const root=clean(baseUrl),secret=clean(token);if(!root||!https(root)||!secret||typeof fetchImpl!=="function")return null;
 async function call(path,payload){
  const controller=new AbortController();const safeTimeout=Math.max(1000,Math.min(120000,Number(timeoutMs)||30000));
  const timer=setTimeout(()=>controller.abort(),safeTimeout);
  try{
   const response=await fetchImpl(root.replace(/\/$/,"")+path,{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify(payload),signal:controller.signal});
   if(!response.ok)return null;return await response.json();
  }catch{return null;}finally{clearTimeout(timer);}
 }
 const inspect=(kind)=>(asset,context)=>call("/inspect/"+kind,{assetId:asset.assetId,businessId:asset.businessId,storageKey:asset.storageKey,contentType:asset.contentType,context});
 return{
  inspectImage:inspect("image"),inspectVideo:inspect("video"),
  optimizeImage:(asset,inspected,context)=>call("/optimize/image",{assetId:asset.assetId,businessId:asset.businessId,storageKey:asset.storageKey,inspected,context}),
  transcodeVideo:(asset,inspected,context)=>call("/transcode/video",{assetId:asset.assetId,businessId:asset.businessId,storageKey:asset.storageKey,inspected,context})
 };
}
function getConfiguredMediaProcessingDrivers(env=process.env,fetchImpl=globalThis.fetch){
 return createHttpMediaProcessingDrivers({baseUrl:env.DEMEOS_MEDIA_PROCESSING_URL,token:env.DEMEOS_MEDIA_PROCESSING_TOKEN,fetchImpl});
}
module.exports={createHttpMediaProcessingDrivers,getConfiguredMediaProcessingDrivers};
