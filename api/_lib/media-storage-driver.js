const {createMediaStorageAdapter}=require("./media-storage-adapter.js");
function clean(v){return typeof v==="string"&&v.trim()?v.trim():null;}
function createHttpObjectStorageDriver({baseUrl,token,fetchImpl=globalThis.fetch,timeoutMs=15000}={}){
 const root=clean(baseUrl),secret=clean(token);
 if(!root||!/^https:\/\//i.test(root)||!secret||typeof fetchImpl!=="function")return null;
 const urlFor=key=>root.replace(/\/$/,"")+"/"+key.split("/").map(encodeURIComponent).join("/");
 async function request(url,options){
  const controller=new AbortController(),safeTimeout=Math.max(1000,Math.min(60000,Number(timeoutMs)||15000));
  const timer=setTimeout(()=>controller.abort(),safeTimeout);
  try{return await fetchImpl(url,{...options,signal:controller.signal});}catch{return null;}finally{clearTimeout(timer);}
 }
 return{
  async createUpload({storageKey,contentType,sizeBytes,expiresAt}){
   const response=await request(urlFor(storageKey)+"?upload=1",{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},
    body:JSON.stringify({contentType,sizeBytes,expiresAt})});
   if(!response||!response.ok)return null;let body;try{body=await response.json();}catch{return null;}
   return{storageKey,uploadUrl:body&&body.uploadUrl};
  },
  async verifyUpload({storageKey}){
   const response=await request(urlFor(storageKey),{method:"HEAD",headers:{authorization:"Bearer "+secret}});
   if(!response||!response.ok)return null;
   return{exists:true,storageKey,contentType:response.headers.get("content-type"),
    sizeBytes:Number(response.headers.get("content-length"))||null,etag:(response.headers.get("etag")||"").replace(/^"|"$/g,"")||null};
  }
 };
}
async function loadVercelBlobSdk(loader){
 try{return await (loader?loader():import("@vercel/blob"));}catch{return null;}
}
function createVercelBlobStorageDriver({token,blobSdkLoader}={}){
 const secret=clean(token);if(!secret)return null;
 return{
  async createUpload({storageKey,contentType,sizeBytes,expiresAt}){
   const sdk=await loadVercelBlobSdk(blobSdkLoader);if(!sdk||typeof sdk.issueSignedToken!=="function"||typeof sdk.presignUrl!=="function")return null;
   const validUntil=Date.parse(expiresAt);if(!Number.isFinite(validUntil)||validUntil<=Date.now())return null;
   try{
    const signed=await sdk.issueSignedToken({pathname:storageKey,operations:["put"],validUntil,
     ...(contentType?{allowedContentTypes:[contentType]}:{}),...(sizeBytes?{maximumSizeInBytes:Number(sizeBytes)}:{}),token:secret});
    const result=await sdk.presignUrl(signed,{operation:"put",pathname:storageKey,access:"private",validUntil,
     ...(contentType?{allowedContentTypes:[contentType]}:{}),...(sizeBytes?{maximumSizeInBytes:Number(sizeBytes)}:{}),addRandomSuffix:false,allowOverwrite:false});
    return result&&/^https:\/\//i.test(result.presignedUrl||"")?{storageKey,uploadUrl:result.presignedUrl}:null;
   }catch{return null;}
  },
  async verifyUpload({storageKey}){
   const sdk=await loadVercelBlobSdk(blobSdkLoader);if(!sdk||typeof sdk.head!=="function")return null;
   try{
    const result=await sdk.head(storageKey,{access:"private",token:secret});
    if(!result)return null;
    return{exists:true,storageKey,contentType:result.contentType||null,sizeBytes:Number(result.size)||null,etag:clean(result.etag)};
   }catch{return null;}
  }
 };
}

function getConfiguredMediaStorageAdapter(env=process.env,fetchImpl=globalThis.fetch){
 const provider=clean(env.DEMEOS_MEDIA_STORAGE_PROVIDER)||"http";\n const driver=provider==="vercel-blob"\n  ?createVercelBlobStorageDriver({token:env.BLOB_READ_WRITE_TOKEN})\n  :provider==="http"?createHttpObjectStorageDriver({baseUrl:env.DEMEOS_MEDIA_STORAGE_URL,token:env.DEMEOS_MEDIA_STORAGE_TOKEN,fetchImpl}):null;
 return driver?createMediaStorageAdapter(driver):null;
}
function getMediaStorageConfiguration(env=process.env){
 const provider=clean(env.DEMEOS_MEDIA_STORAGE_PROVIDER)||"http";
 return{provider,configured:provider==="vercel-blob"?Boolean(clean(env.BLOB_READ_WRITE_TOKEN)):provider==="http"&&Boolean(clean(env.DEMEOS_MEDIA_STORAGE_URL)&&clean(env.DEMEOS_MEDIA_STORAGE_TOKEN))};
}
module.exports={createHttpObjectStorageDriver,createVercelBlobStorageDriver,getConfiguredMediaStorageAdapter,getMediaStorageConfiguration};
