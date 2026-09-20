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
function getConfiguredMediaStorageAdapter(env=process.env,fetchImpl=globalThis.fetch){
 const provider=clean(env.DEMEOS_MEDIA_STORAGE_PROVIDER)||"http";
 if(provider!=="http")return null;
 const driver=createHttpObjectStorageDriver({baseUrl:env.DEMEOS_MEDIA_STORAGE_URL,token:env.DEMEOS_MEDIA_STORAGE_TOKEN,fetchImpl});
 return driver?createMediaStorageAdapter(driver):null;
}
function getMediaStorageConfiguration(env=process.env){
 const provider=clean(env.DEMEOS_MEDIA_STORAGE_PROVIDER)||"http";
 return{provider,configured:provider==="http"&&Boolean(clean(env.DEMEOS_MEDIA_STORAGE_URL)&&clean(env.DEMEOS_MEDIA_STORAGE_TOKEN))};
}
module.exports={createHttpObjectStorageDriver,getConfiguredMediaStorageAdapter,getMediaStorageConfiguration};
