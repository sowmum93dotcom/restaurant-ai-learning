const { IMAGE_CONTENT_TYPES, VIDEO_CONTENT_TYPES, MAX_VIDEO_DURATION_SECONDS }=require("./media-asset-contract.js");
function isHttps(value){return typeof value==="string"&&/^https:\/\//i.test(value.trim());}
function positiveInt(value){return Number.isInteger(value)&&value>0;}
function expectedOutputs(context){return new Map(Array.isArray(context&&context.outputDestinations)?context.outputDestinations.map(x=>[x.role,x.storageKey]):[]);}
function outputMatches(asset,context,optimized){
 const expected=expectedOutputs(context);if(!expected.size||!optimized||optimized.storageKey!==expected.get("master"))return false;
 if(!outputMatches(asset,context,optimized))return false;
 return optimized.derivatives.every(d=>d&&expected.has(d.role)&&d.storageKey===expected.get(d.role));
}
function createMediaProcessor({inspectImage,inspectVideo,optimizeImage,transcodeVideo}={}){
 return async function processMedia(asset,context={}){
  if(!asset||asset.state!=="processing"||!asset.storageKey)return{success:false,error:"Media source is not available for processing."};
  if(asset.kind==="image"){
   if(typeof inspectImage!=="function"||typeof optimizeImage!=="function")return{success:false,error:"Image processing is not configured."};
   const inspected=await inspectImage(asset,context);
   if(!inspected||!IMAGE_CONTENT_TYPES.includes(inspected.contentType)||!positiveInt(inspected.width)||!positiveInt(inspected.height))
    return{success:false,error:"Image inspection failed."};
   const optimized=await optimizeImage(asset,inspected,context);
   if(!optimized||!isHttps(optimized.deliveryUrl)||!Array.isArray(optimized.derivatives)||!optimized.derivatives.length)
    return{success:false,error:"Image optimization failed."};
   return{success:true,deliveryUrl:optimized.deliveryUrl,width:inspected.width,height:inspected.height,derivatives:optimized.derivatives};
  }
  if(asset.kind==="video"){
   if(typeof inspectVideo!=="function"||typeof transcodeVideo!=="function")return{success:false,error:"Video processing is not configured."};
   const inspected=await inspectVideo(asset,context);
   if(!inspected||!VIDEO_CONTENT_TYPES.includes(inspected.contentType)||!positiveInt(inspected.width)||!positiveInt(inspected.height)||
      typeof inspected.durationSeconds!=="number"||inspected.durationSeconds<=0||inspected.durationSeconds>MAX_VIDEO_DURATION_SECONDS)
    return{success:false,error:"Video inspection failed."};
   const optimized=await transcodeVideo(asset,inspected,context);
   if(!optimized||!isHttps(optimized.deliveryUrl)||!Array.isArray(optimized.derivatives)||!optimized.derivatives.length)
    return{success:false,error:"Video processing failed."};
   return{success:true,deliveryUrl:optimized.deliveryUrl,width:inspected.width,height:inspected.height,
    durationSeconds:inspected.durationSeconds,derivatives:optimized.derivatives};
  }
  return{success:false,error:"Unsupported media kind."};
 };
}
module.exports={createMediaProcessor};
