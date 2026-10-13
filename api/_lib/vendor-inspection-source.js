'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createWriteStream}=require('node:fs');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
function invalid(message){const error=Error(message);error.status=409;throw error;}
async function inspectFile(filename,asset){
 if(asset.kind==='image'){
  let metadata;try{metadata=await require('sharp')(filename,{limitInputPixels:40000000}).metadata();}catch{invalid('Choose a valid JPG, PNG or WebP image.');}
  const formats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
  if(metadata.format!==formats[asset.contentType]||!metadata.width||!metadata.height||metadata.width*metadata.height>40000000)invalid('Choose a valid image of up to 40 million pixels.');
  return {width:metadata.width,height:metadata.height};
 }
 let metadata;
 try{
  const executable=require('@ffprobe-installer/ffprobe').path;
  const {stdout}=await execFile(executable,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov','-show_entries','format=format_name,duration:stream=codec_type,width,height','-of','json',filename],{timeout:8000,maxBuffer:65536,windowsHide:true});
  metadata=JSON.parse(stdout);
 }catch{invalid('Choose a valid MP4 or MOV video.');}
 const video=metadata.streams?.find(stream=>stream.codec_type==='video'),durationSeconds=Number(metadata.format?.duration);
 if(!video||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>60||!video.width||!video.height||video.width*video.height>40000000)invalid('Choose a video no longer than 60 seconds and up to 40 million pixels.');
 return {width:video.width,height:video.height,durationSeconds};
}
async function inspectStoredOriginal(asset,url,{fetchImpl=globalThis.fetch,inspect=inspectFile}={}){
 const address=new URL(url);
 if(address.protocol!=='https:'||!(address.hostname==='blob.vercel-storage.com'||address.hostname.endsWith('.blob.vercel-storage.com')))invalid('Private test media source is unavailable.');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-preview-media-')),filename=path.join(directory,'original');
 try{
  const response=await fetchImpl(address,{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.body)invalid('The private test upload could not be opened.');
  let bytes=0;
  async function* boundedBody(){for await(const chunk of Readable.fromWeb(response.body)){bytes+=chunk.length;if(bytes>asset.sizeBytes)invalid('The uploaded file size does not match.');yield chunk;}}
  await pipeline(Readable.from(boundedBody()),createWriteStream(filename,{flags:'wx',mode:0o600}));
  if(bytes!==asset.sizeBytes)invalid('The uploaded file size does not match.');
  return await inspect(filename,asset);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
}
module.exports={inspectStoredOriginal,inspectFile};
