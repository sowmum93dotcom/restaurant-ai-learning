const {createMediaStorageAdapter}=require("./media-storage-adapter.js");
function clean(v){return typeof v==="string"&&v.trim()?v.trim():null;}
function createHttpObjectStorageDriver({baseUrl,token,fetchImpl=globalThis.fetch}={}){
 const root=clean(baseUrl),secret=clean(token);
 if(!root||!/^https:\/\//i.test(root)||!secret||typeof fetchImpl!=="function")return null;
 const urlFor=key=>root.replace(/\/$/,"")+"/"+key.split("/").map(encodeURIComponent).join("/");
 return{
  async createUpload({storageKey,contentType,sizeBytes,expiresAt}){
   const response=await fetchImpl(urlFor(storageKey)+"?upload=1",{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},
    body:JSON.stringify({contentType,sizeBytes,expiresAt})});
   if(!response.ok)return null;const body=await response.json();
   return{storageKey,uploadUrl:body&&body.uploadUrl};
  },
  async verifyUpload({storageKey}){
   const response=await fetchImpl(urlFor(storageKey),{method:"HEAD",headers:{authorization:"Bearer "+secret}});
   if(!response.ok)return null;
   return{exists:true,storageKey,contentType:response.headers.get("content-type"),
    sizeBytes:Number(response.headers.get("content-length"))||null,etag:(response.headers.get("etag")||"").replace(/^"|"$/g,"")||null};
  }
 };
}
function getConfiguredMediaStorageAdapter(env=process.env,fetchImpl=globalThis.fetch){
 const driver=createHttpObjectStorageDriver({baseUrl:env.DEMEOS_MEDIA_STORAGE_URL,token:env.DEMEOS_MEDIA_STORAGE_TOKEN,fetchImpl});
 return driver?createMediaStorageAdapter(driver):null;
}
module.exports={createHttpObjectStorageDriver,getConfiguredMediaStorageAdapter};
