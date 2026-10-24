'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),MAX_BYTES=250*1024*1024;
function allowedUrl(value,hosts){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||!hosts.includes(url.hostname))throw Error('Unapproved storage destination');
 return url.href;
}
function scope(payload){
 if(!payload||typeof payload.businessId!=='string'||!payload.businessId||typeof payload.assetId!=='string'||!payload.assetId)throw Error('Missing asset scope');
 return `businesses/${encodeURIComponent(payload.businessId)}/media/${encodeURIComponent(payload.assetId)}/`;
}
async function run(binary,args,timeout){
 return (await exec(binary,args,{timeout,killSignal:'SIGKILL',maxBuffer:1024*1024,windowsHide:true,env:{LANG:'C',LC_ALL:'C'}})).stdout;
}
async function probe(file,{ffprobePath='ffprobe'}={}){
 const data=JSON.parse(await run(ffprobePath,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],4000));
 const video=data.streams?.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),duration=Number(data.format?.duration);
 if(!data.format?.format_name?.split(',').some(f=>['mov','mp4'].includes(f))||!video||!Number.isFinite(duration)||duration<=0||duration>60||!Number.isInteger(video.width)||video.width<2||!Number.isInteger(video.height)||video.height<2||video.width*video.height>3840*2160)throw Error('Video must be MP4/MOV, at most 60 seconds and at most 4K');
 const [n,d]=String(video.avg_frame_rate).split('/').map(Number);if(!d||n/d>120)throw Error('Video frame rate exceeds 120 fps');
 return {contentType:'video/mp4',width:video.width,height:video.height,durationSeconds:duration};
}
function createProcessor({hosts=[],fetchImpl=globalThis.fetch,ffmpegPath='ffmpeg',ffprobePath='ffprobe',transcodeTimeoutMs=22000}={}){
 if(!hosts.length)throw Error('STORAGE_HOSTS must contain exact approved Blob hostnames');
 // Only the trusted native driver opts into the longer encoding window. The
 // standalone HTTP processor retains its existing caller-compatible budget.
 if(!Number.isSafeInteger(transcodeTimeoutMs)||transcodeTimeoutMs<1000||transcodeTimeoutMs>90000)throw Error('Invalid video encoding deadline');
 async function source(payload,file){
  const prefix=scope(payload);
  if(typeof payload.storageKey!=='string'||!payload.storageKey.startsWith(prefix)||payload.storageKey.slice(prefix.length).includes('..'))throw Error('Unscoped source');
  const expires=Date.parse(payload.sourceExpiresAt);if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+6*60*1000)throw Error('Expired source capability');
  const response=await fetchImpl(allowedUrl(payload.sourceUrl,hosts),{redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok||!response.body||Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Source unavailable or too large');
  const handle=await fs.open(file,'wx');let total=0;
  try{for await(const bytes of response.body){total+=bytes.length;if(total>MAX_BYTES)throw Error('Source exceeds 250 MB');await handle.writeFile(bytes);}}finally{await handle.close();}
  if(!total)throw Error('Empty source');
 }
 return async function processVideo(operation,payload){
  if(!['inspect','transcode','frames'].includes(operation))throw Error('Unsupported operation');
  const prefix=scope(payload),destinations=payload.outputDestinations;
  if(operation==='transcode'){
   if(!Array.isArray(destinations)||destinations.length!==3||new Set(destinations.map(d=>d.role)).size!==3)throw Error('Three distinct private outputs required');
   for(const d of destinations){
    if(!['master','customer','marketing'].includes(d.role)||d.storageKey!==prefix+'processed/'+d.role+'.mp4'||d.contentType!=='video/mp4')throw Error('Unscoped output');
    allowedUrl(d.uploadUrl,hosts);allowedUrl(d.deliveryUrl,hosts);
    if(Object.keys(d.headers||{}).some(key=>!['x-content-type','x-vercel-blob-access'].includes(key.toLowerCase())))throw Error('Unapproved upload header');
   }
  }
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-video-'));
  try{
   const original=path.join(directory,'source'),output=path.join(directory,'video.mp4');
   await source(payload,original);const inspected=await probe(original,{ffprobePath});
   if(operation==='inspect')return inspected;
   if(operation==='frames'){
    if(payload.frameProtocolVersion!==1||!payload.storageKey.startsWith(prefix+'processed/')||!payload.storageKey.endsWith('.mp4'))throw Error('A processed MP4 and frame protocol v1 are required');
    const {createHash}=require('node:crypto'),sourceDigest=createHash('sha256');
    for await(const chunk of require('node:fs').createReadStream(original))sourceDigest.update(chunk);
    const frames=[];
    for(let i=0;i<4;i++){
     const timestampSeconds=Number((inspected.durationSeconds*(i+.5)/4).toFixed(3)),file=path.join(directory,'frame-'+i+'.jpg');
     await run(ffmpegPath,['-hide_banner','-loglevel','error','-nostdin','-threads','1','-protocol_whitelist','file,pipe','-ss',String(timestampSeconds),'-i',original,'-map','0:v:0','-frames:v','1','-sn','-dn','-map_metadata','-1','-vf',"scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease",'-q:v','5','-threads','1',file],3000);
     const bytes=await fs.readFile(file);if(!bytes.length||bytes.length>262144)throw Error('Frame exceeds its byte budget');
     const sharp=require('sharp'),metadata=await sharp(bytes,{limitInputPixels:640*640,failOn:'warning'}).metadata();
     if(metadata.format!=='jpeg'||!metadata.width||!metadata.height)throw Error('Invalid extracted frame');
     frames.push({index:i,timestampSeconds,width:metadata.width,height:metadata.height,sizeBytes:bytes.length,contentType:'image/jpeg',contentHash:createHash('sha256').update(bytes).digest('hex'),bytesBase64:bytes.toString('base64')});
    }
    return {schemaVersion:1,sourceAssetId:payload.assetId,sourceHash:sourceDigest.digest('hex'),durationSeconds:inspected.durationSeconds,frames,limitation:'four-sampled-frames-not-full-video'};
   }
   // Decode only the downloaded file. Network protocols, subtitles and data streams are excluded.
   // Discard excess input frames before scaling. Output-only -r still scales
   // every high-frame-rate source frame before dropping it at the encoder.
   await run(ffmpegPath,['-hide_banner','-loglevel','error','-nostdin','-threads','1','-protocol_whitelist','file,pipe','-i',original,'-map','0:v:0','-map','0:a:0?','-sn','-dn','-map_metadata','-1','-t','60','-vf',"fps=30,scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-r','30','-c:v','libx264','-threads','1','-preset','veryfast','-crf','25','-maxrate','2500k','-bufsize','5000k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ac','2','-movflags','+faststart','-f','mp4',output],transcodeTimeoutMs);
   const encoded=await probe(output,{ffprobePath}),bytes=await fs.readFile(output);
   if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Invalid encoded output');
   await Promise.all(destinations.map(async d=>{
    const response=await fetchImpl(d.uploadUrl,{method:'PUT',redirect:'error',headers:{...d.headers,'content-type':'video/mp4'},body:bytes,signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Private output upload failed');
   }));
   const metadata=d=>({role:d.role,storageKey:d.storageKey,deliveryUrl:d.deliveryUrl,...encoded});
   const master=destinations.find(d=>d.role==='master');
   return {...metadata(master),derivatives:destinations.filter(d=>d.role!=='master').map(metadata)};
  }finally{await fs.rm(directory,{recursive:true,force:true});}
 };
}
module.exports={createProcessor,allowedUrl,probe,run};
