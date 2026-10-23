'use strict';
// One authenticated native transport shared by ROOT and Selling. No caller-selected URL.
const {createHmac,randomUUID}=require('node:crypto');
const {gzipSync}=require('node:zlib');
async function readBounded(response,maximum,signal){
 if(!response.ok||!response.body)throw Error('private-runtime-request-failed');
 const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximum))throw Error('response-too-large');
 const reader=response.body.getReader(),chunks=[];const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});let size=0,complete=false;
 try{while(true){if(signal.aborted)throw Error('aborted');const {done,value}=await reader.read();if(done){complete=true;break;}size+=value.length;if(size>maximum)throw Error('response-too-large');chunks.push(Buffer.from(value));}if(signal.aborted)throw Error('aborted');return Buffer.concat(chunks);}finally{signal.removeEventListener('abort',abort);if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function sendNativeRequest({config,input,inputHash,limits,deadline,signal,media=[],fetchImpl=globalThis.fetch}){
 const jobId=randomUUID();
 const payload=JSON.stringify({protocolVersion:1,jobId,issuedAt:Date.now(),deadline,modelId:config.manifest.modelId,modelVersion:config.manifest.modelVersion,weightsManifestHash:config.manifest.weightsManifestHash,runtimeCodeHash:config.manifest.runtimeCodeHash,inputHash,input,media});
 const wire=gzipSync(Buffer.from(payload),{level:1});
 const signature=createHmac('sha256',config.secret).update(wire).digest('hex');
 const response=await fetchImpl(config.origin+'/v1/infer',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','Content-Encoding':'gzip',Authorization:'Bearer '+config.secret,'X-DEMEOS-Signature':signature},body:wire});
 const body=JSON.parse((await readBounded(response,limits.maxOutputBytes+4096,signal)).toString('utf8'));
 if(Object.keys(body).some(k=>!['protocolVersion','jobId','inputHash','modelVersion','weightsManifestHash','runtimeCodeHash','output','measurements'].includes(k))||Object.keys(body.measurements||{}).some(k=>!['durationMs','peakVramBytes'].includes(k))||body.protocolVersion!==1||body.jobId!==jobId||body.inputHash!==inputHash||body.modelVersion!==config.manifest.modelVersion||body.weightsManifestHash!==config.manifest.weightsManifestHash||body.runtimeCodeHash!==config.manifest.runtimeCodeHash||!Number.isFinite(body.measurements?.durationMs)||body.measurements.durationMs<0||body.measurements.durationMs>limits.timeoutMs||!Number.isSafeInteger(body.measurements.peakVramBytes)||body.measurements.peakVramBytes<0)throw Error('invalid-runtime-provenance');
 return {output:body.output,measurements:body.measurements};
}
module.exports={readBounded,sendNativeRequest};
