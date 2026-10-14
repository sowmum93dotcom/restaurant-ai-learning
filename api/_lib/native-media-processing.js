'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createWriteStream}=require('node:fs');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {inspectFile}=require('./vendor-inspection-source');
function blobAddress(value){const url=new URL(value);if(url.protocol!=='https:'||!url.hostname.endsWith('.blob.vercel-storage.com'))throw Error('Private media address is invalid.');return url;}
function createNativeMediaProcessingDrivers({storage,fetchImpl=globalThis.fetch}={}){
 if(!storage?.createDeliveryRead)return null;
 async function inspect(asset,context){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-media-')),filename=path.join(directory,'original');
  try{
   if(!Number.isInteger(asset.sizeBytes)||asset.sizeBytes<=0||asset.sizeBytes>250*1024*1024)throw Error('Media size is invalid.');
   const response=await fetchImpl(blobAddress(context.sourceUrl),{redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok||!response.body)throw Error('Private media source is unavailable.');
   let bytes=0;
   async function* bounded(){for await(const chunk of Readable.fromWeb(response.body)){bytes+=chunk.length;if(bytes>asset.sizeBytes)throw Error('Media size does not match.');yield chunk;}}
   await pipeline(Readable.from(bounded()),createWriteStream(filename,{flags:'wx',mode:0o600}));
   if(bytes!==asset.sizeBytes)throw Error('Media size does not match.');
   const metadata=await inspectFile(filename,asset);
   return {...metadata,contentType:asset.contentType,directory,filename};
  }catch(error){await fs.rm(directory,{recursive:true,force:true});throw Error('The uploaded file could not be inspected.');}
 }
 async function optimize(asset,inspected,context){
  const outputs=context.outputDestinations;
  try{
   const roles=asset.kind==='image'?['master','thumbnail','customer','marketing']:['master','customer','marketing'];
   if(!Array.isArray(outputs)||outputs.length!==roles.length||roles.some(role=>outputs.filter(d=>d.role===role).length!==1))throw Error('Media destinations are incomplete.');
   const prefix=['businesses',encodeURIComponent(asset.businessId),'media',encodeURIComponent(asset.assetId),'processed',''].join('/');
   const type=asset.kind==='image'?'image/webp':'video/mp4',ext=asset.kind==='image'?'.webp':'.mp4';
   for(const out of outputs){if(out.storageKey!==prefix+out.role+ext||out.contentType!==type)throw Error('Media destination is invalid.');blobAddress(out.uploadUrl);}
   let video;
   if(asset.kind==='video'){
    video=path.join(inspected.directory,'output.mp4');
    await execFile(require('ffmpeg-static'),['-nostdin','-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov','-i',inspected.filename,'-map','0:v:0','-map','0:a?','-vf',"scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",'-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-t','60','-threads','2',video],{timeout:180000,maxBuffer:65536,windowsHide:true});
   }
   const delivered=[];
   for(const out of outputs){
    let bytes,metadata;
    if(asset.kind==='image'){
     bytes=await require('sharp')(inspected.filename,{limitInputPixels:40000000}).rotate().resize({width:out.role==='thumbnail'?320:1920,withoutEnlargement:true}).webp({quality:82}).toBuffer();
     metadata=await require('sharp')(bytes).metadata();
    }else{
     bytes=await fs.readFile(video);metadata=await inspectFile(video,{kind:'video',contentType:'video/mp4'});
    }
    if(bytes.length>(asset.kind==='image'?15:250)*1024*1024)throw Error('Processed media is too large.');
    const uploaded=await fetchImpl(blobAddress(out.uploadUrl),{method:'PUT',headers:{'Content-Type':type},body:bytes,redirect:'error',signal:AbortSignal.timeout(45000)});
    if(!uploaded.ok)throw Error('Private processed media could not be saved.');
    const read=await storage.createDeliveryRead({storageKey:out.storageKey,expiresAt:new Date(Date.now()+15*60*1000).toISOString()});
    if(!read)throw Error('Private processed media could not be opened.');
    delivered.push({role:out.role,storageKey:out.storageKey,deliveryUrl:read.deliveryUrl,contentType:type,width:metadata.width,height:metadata.height,...(asset.kind==='video'?{durationSeconds:metadata.durationSeconds}:{})});
   }
   const master=delivered.find(d=>d.role==='master');
   return {...master,derivatives:delivered.filter(d=>d.role!=='master')};
  }finally{await fs.rm(inspected.directory,{recursive:true,force:true});}
 }
 return {inspectImage:inspect,inspectVideo:inspect,optimizeImage:optimize,transcodeVideo:optimize};
}
module.exports={createNativeMediaProcessingDrivers,blobAddress};
