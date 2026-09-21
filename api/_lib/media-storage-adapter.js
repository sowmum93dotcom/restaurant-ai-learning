function clean(value){return typeof value==="string"&&value.trim()?value.trim():null;}
function storageKeyFor(asset){
 if(!asset||!clean(asset.businessId)||!clean(asset.assetId)||!clean(asset.kind))return null;
 return ["businesses",encodeURIComponent(asset.businessId),"media",encodeURIComponent(asset.assetId),"original"].join("/");
}
function createMediaStorageAdapter(driver){
 if(!driver||typeof driver.createUpload!=="function"||typeof driver.verifyUpload!=="function")return null;
 return Object.freeze({
  async createUpload(asset,session){
   const storageKey=storageKeyFor(asset); if(!storageKey)return null;
   const result=await driver.createUpload({storageKey,contentType:asset.contentType||null,sizeBytes:asset.sizeBytes||null,businessId:asset.businessId,assetId:asset.assetId,expiresAt:session.expiresAt});
   if(!result||clean(result.storageKey)!==storageKey||!clean(result.uploadUrl)||!/^https:\/\//i.test(result.uploadUrl))return null;
   return {storageKey,uploadUrl:result.uploadUrl,expiresAt:session.expiresAt};
  },
  async verifyUpload(asset,storageKey){
   const expected=storageKeyFor(asset); if(!expected||storageKey!==expected)return null;
   const result=await driver.verifyUpload({storageKey,businessId:asset.businessId,assetId:asset.assetId});
   if(!result||result.exists!==true||clean(result.storageKey)!==expected)return null;
   if(asset.contentType&&result.contentType!==asset.contentType)return null;
   if(asset.sizeBytes&&Number(result.sizeBytes)!==Number(asset.sizeBytes))return null;
   return {storageKey:expected,contentType:result.contentType||asset.contentType||null,sizeBytes:Number(result.sizeBytes)||asset.sizeBytes||null,etag:clean(result.etag)};
  },
  async createDeliveryRead({storageKey,expiresAt}){
   if(!clean(storageKey)||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()||typeof driver.createDeliveryRead!=="function")return null;
   try{
    const result=await driver.createDeliveryRead({storageKey,expiresAt});
    if(!result||result.storageKey!==storageKey||!/^https:\/\//i.test(result.deliveryUrl||""))return null;
    return {storageKey,deliveryUrl:result.deliveryUrl,expiresAt};
   }catch{return null;}
  }
 });
}
module.exports={storageKeyFor,createMediaStorageAdapter};
