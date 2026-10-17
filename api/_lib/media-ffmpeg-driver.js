'use strict';
const fs=require('node:fs');
const {createProcessor}=require('../../tools/video-processor/processor');
let active=false;
function createFfmpegVideoDrivers({fetchImpl=globalThis.fetch}={}){
 // The deployed Vercel Node runtime is Linux/x64. Static literal resolution keeps
 // the other ffprobe platform binaries out of the traced Function bundle.
 if(process.platform!=='linux'||process.arch!=='x64')return null;
 let ffmpegPath,ffprobePath;
 try{ffmpegPath=require('ffmpeg-static');ffprobePath=require.resolve('@ffprobe-installer/linux-x64/ffprobe');fs.accessSync(ffmpegPath,fs.constants.X_OK);fs.accessSync(ffprobePath,fs.constants.X_OK);}catch{return null;}
 async function execute(operation,asset,context){
  if(active)return null;
  // All capabilities come from the existing private-storage worker, never from
  // the browser's request body. No permanent storage token is passed to FFmpeg.
  const capabilities=[context?.sourceUrl,...(context?.outputDestinations||[]).flatMap(d=>[d.uploadUrl,d.deliveryUrl]).filter(Boolean)];
  let hosts;try{hosts=[...new Set(capabilities.map(value=>new URL(value).hostname))];}catch{return null;}
  active=true;
  try{return await createProcessor({hosts,fetchImpl,ffmpegPath,ffprobePath})(operation,{assetId:asset.assetId,businessId:asset.businessId,storageKey:asset.storageKey,contentType:asset.contentType,sourceUrl:context.sourceUrl,sourceExpiresAt:context.sourceExpiresAt,...(operation==='frames'?{frameProtocolVersion:1}:{}),...(context.outputDestinations?{outputDestinations:context.outputDestinations}:{})});}finally{active=false;}
 }
 return {inspectVideo:(asset,context)=>execute('inspect',asset,context),transcodeVideo:(asset,_inspected,context)=>execute('transcode',asset,context),extractVideoFrames:(asset,context)=>execute('frames',asset,context)};
}
module.exports={createFfmpegVideoDrivers};
