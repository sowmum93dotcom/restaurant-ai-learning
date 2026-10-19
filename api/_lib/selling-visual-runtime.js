'use strict';
// DEMEOS-operated GPU transport. No request-selected endpoint or media URL.
const {createHash,createHmac,randomUUID}=require('node:crypto');
const boundary=require('./selling-model-boundary'),access=require('./selling-access');
const readiness=require('./selling-visual-readiness'),frames=require('./selling-video-frames');
const {hash}=require('./selling-native-intelligence'),{catalogueRevision}=require('./vendor-inventory');
const MODEL='Qwen3-VL-4B-Instruct',REVISION='ebb281ec70b05090aa6165b016eac8ec08e71b17';
function configuration(env){
 try{
  if(env.DEMEOS_VISUAL_RUNTIME_ENABLED!=='true'||!access.isolatedTestEnvironment(env))return null;
  const origin=new URL(env.DEMEOS_VISUAL_RUNTIME_ORIGIN),manifest=JSON.parse(env.DEMEOS_VISUAL_RUNTIME_MANIFEST||'null');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.hostname!==env.DEMEOS_VISUAL_RUNTIME_HOST||!/^[!-~]{32,256}$/.test(env.DEMEOS_VISUAL_RUNTIME_SECRET||''))return null;
  if(manifest?.operator!=='DEMEOS'||manifest.modelId!==MODEL||manifest.modelVersion!==REVISION||!/^[a-f0-9]{64}$/.test(manifest.weightsManifestHash||'')||!/^[a-f0-9]{64}$/.test(manifest.runtimeCodeHash||'')||!['licenceReviewId','securityReviewId','benchmarkReviewId'].every(k=>/^[a-zA-Z0-9_.:-]{1,120}$/.test(manifest[k]||''))||manifest.benchmarkTimeoutMs!==boundary.VISUAL_CONTRACT.limits.timeoutMs||!Array.isArray(manifest.capabilities)||!manifest.capabilities.length||!manifest.capabilities.every(c=>boundary.VISUAL_CONTRACT.capabilities.includes(c)))return null;
  const hosts=(env.DEMEOS_VISUAL_MEDIA_HOSTS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!hosts.length||hosts.some(h=>!/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(h)))return null;
  return {origin:origin.origin,manifest,hosts,secret:env.DEMEOS_VISUAL_RUNTIME_SECRET};
 }catch{return null;}
}
async function readBounded(response,maximum,signal){
 if(!response.ok||!response.body)throw Error('private-runtime-request-failed');
 const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximum))throw Error('response-too-large');
 const reader=response.body.getReader(),chunks=[];const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});let size=0,complete=false;
 try{while(true){if(signal.aborted)throw Error('aborted');const {done,value}=await reader.read();if(done){complete=true;break;}size+=value.length;if(size>maximum)throw Error('response-too-large');chunks.push(Buffer.from(value));}if(signal.aborted)throw Error('aborted');return Buffer.concat(chunks);}finally{signal.removeEventListener('abort',abort);if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function selectMedia(product,assets){
 const owned=assets.filter(a=>a.businessId===product.businessId&&a.relatedEntityId===product.productId&&product.mediaGallery?.assetIds?.includes(a.assetId)&&a.state==='ready');
 const image=owned.find(a=>a.assetId===product.mediaGallery?.mainAssetId&&a.kind==='image')||owned.find(a=>a.kind==='image');
 if(image)return {capability:'image-semantics',media:[{assetId:image.assetId,contentHash:image.processedHash,sizeBytes:image.processedSizeBytes,width:image.width,height:image.height,contentType:'image/webp'}]};
 const video=owned.find(a=>frames.validate(a,a.videoFrames));
 if(video)return {capability:'video-frame-semantics',media:video.videoFrames.frames.map(f=>({assetId:video.assetId,contentHash:f.contentHash,sizeBytes:f.sizeBytes,width:f.width,height:f.height,contentType:f.contentType,frameIndex:f.index,timestampSeconds:f.timestampSeconds}))};
 return null;
}
function createConfiguredVisualRunner({store,environment,backend,fetchImpl=globalThis.fetch}={}){
 const config=configuration(environment);if(!config||typeof store?.createSellingModelLedger!=='function'||typeof backend?.driver?.createProcessingRead!=='function')return null;
 const signature=hash([boundary.VISUAL_CONTRACT,config.manifest,'demeos-private-runtime-v1']);
 return {signature,async analyze({profile,product,assets,identity}){
  // Real/live business media remains disabled even when a Preview is misconfigured.
  if(access.dataEnvironment(profile.businessId,environment,identity)!=='test')return {status:'unavailable',code:'preview-authorisation-required'};
  const selection=selectMedia(product,assets);if(!selection)return {status:'unavailable',code:'verified-media-required'};
  const input={schemaVersion:2,inputSchema:boundary.VISUAL_CONTRACT.inputSchema,...selection,businessId:profile.businessId,productId:product.productId,productRevision:catalogueRevision(product),mediaRevision:readiness.mediaRevision(assets),text:JSON.stringify({name:product.name||'',description:product.description||''}).slice(0,2000)};
  const authorize=readiness.createVisualAuthorizer({store,environment:()=>environment});let measurements=null;
  const runtime={async execute({input,inputHash,limits,deadline,signal}){
   const media=[];
   for(const descriptor of input.media){
    const asset=assets.find(a=>a.assetId===descriptor.assetId);
    const storageKey=input.capability==='image-semantics'?asset.processedStorageKey:asset.videoFrames.frames.find(f=>f.index===descriptor.frameIndex).storageKey;
    const read=await backend.driver.createProcessingRead({storageKey,expiresAt:new Date(deadline).toISOString()});
    const source=new URL(read?.readUrl);
    if(source.protocol!=='https:'||source.username||source.password||!config.hosts.includes(source.hostname)||read.storageKey!==storageKey)throw Error('private-media-unavailable');
    const response=await fetchImpl(source.href,{redirect:'error',signal});
    const bytes=await readBounded(response,descriptor.sizeBytes,signal);
    if(bytes.length!==descriptor.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==descriptor.contentHash)throw Error('media-integrity-failed');
    media.push(bytes.toString('base64'));
   }
   if(signal.aborted||!await authorize(identity,input))throw Error('scope-changed');
   const jobId=randomUUID();
   const payload=JSON.stringify({protocolVersion:1,jobId,issuedAt:Date.now(),deadline,modelId:config.manifest.modelId,modelVersion:config.manifest.modelVersion,weightsManifestHash:config.manifest.weightsManifestHash,runtimeCodeHash:config.manifest.runtimeCodeHash,inputHash,input,media});
   const signature=createHmac('sha256',config.secret).update(payload).digest('hex');
   const response=await fetchImpl(config.origin+'/v1/infer',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.secret,'X-DEMEOS-Signature':signature},body:payload});
   const body=JSON.parse((await readBounded(response,limits.maxOutputBytes+4096,signal)).toString('utf8'));
   if(Object.keys(body).some(k=>!['protocolVersion','jobId','inputHash','modelVersion','weightsManifestHash','runtimeCodeHash','output','measurements'].includes(k))||Object.keys(body.measurements||{}).some(k=>!['durationMs','peakVramBytes'].includes(k))||body.protocolVersion!==1||body.jobId!==jobId||body.inputHash!==inputHash||body.modelVersion!==config.manifest.modelVersion||body.weightsManifestHash!==config.manifest.weightsManifestHash||body.runtimeCodeHash!==config.manifest.runtimeCodeHash||!Number.isFinite(body.measurements?.durationMs)||body.measurements.durationMs<0||body.measurements.durationMs>limits.timeoutMs||!Number.isSafeInteger(body.measurements.peakVramBytes)||body.measurements.peakVramBytes<0)throw Error('invalid-runtime-provenance');
   measurements=body.measurements;return body.output;
  }};
  const executor=boundary.createExecutionAdapter({manifest:config.manifest,runtime,authorize,ledger:store.createSellingModelLedger()});
  const result=await executor.execute(input,identity);
  return {...result,...(result.status==='succeeded'&&measurements?{measurements}:{})};
 }};
}
module.exports={MODEL,REVISION,configuration,readBounded,selectMedia,createConfiguredVisualRunner};
