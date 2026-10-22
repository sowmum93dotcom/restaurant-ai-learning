'use strict';
// Explicit connection preflight, NOT an inference job or part of its 2s budget.
const {configuration,readBounded}=require('./selling-visual-runtime');
async function check(environment,fetchImpl=globalThis.fetch){
 const config=configuration(environment);if(!config)return {status:'unavailable'};
 const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetchImpl(config.origin+'/healthz',{method:'GET',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+config.secret}});
  const value=JSON.parse((await readBounded(response,4096,controller.signal)).toString('utf8'));
  if(Object.keys(value).sort().join(',')!=='busy,modelId,modelVersion,ready,runtimeCodeHash,weightsManifestHash'||value.ready!==true||value.busy!==false||!['modelId','modelVersion','runtimeCodeHash','weightsManifestHash'].every(k=>value[k]===config.manifest[k]))return {status:'unavailable'};
  return {status:'ready',connectionPreflightMs:Date.now()-started,inferenceExecuted:false};
 }catch{return {status:'unavailable'};}finally{clearTimeout(timer);controller.abort();}
}
module.exports={check};
