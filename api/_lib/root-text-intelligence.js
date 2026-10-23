'use strict';
const {CONTRACT,LIMITS,LOCALES,validateInput,validateOutput,digest}=require('./root-text-contract');
const {MODEL,REVISION}=require('./selling-visual-runtime');
const {sendNativeRequest}=require('./native-runtime-transport');
const {hash}=require('./selling-native-intelligence');
const token=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(v);
function configuration(env){
 try{
  if(env.DEMEOS_ROOT_TEXT_PREVIEW_ENABLED!=='true'||!require('./selling-access').isolatedTestEnvironment(env))return null;
  const origin=new URL(env.DEMEOS_VISUAL_RUNTIME_ORIGIN),manifest=JSON.parse(env.DEMEOS_ROOT_TEXT_RUNTIME_MANIFEST||'null');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.hostname!==env.DEMEOS_VISUAL_RUNTIME_HOST||!/^[!-~]{32,256}$/.test(env.DEMEOS_VISUAL_RUNTIME_SECRET||''))return null;
  if(manifest?.operator!=='DEMEOS'||manifest.modelId!==MODEL||manifest.modelVersion!==REVISION||!digest(manifest.weightsManifestHash)||!digest(manifest.runtimeCodeHash)||!['licenceReviewId','securityReviewId','benchmarkReviewId'].every(k=>token(manifest[k]))||manifest.benchmarkTimeoutMs!==LIMITS.timeoutMs||!Array.isArray(manifest.capabilities)||manifest.capabilities.length!==1||manifest.capabilities[0]!==CONTRACT.capability)return null;
  return {origin:origin.origin,manifest,secret:env.DEMEOS_VISUAL_RUNTIME_SECRET};
 }catch{return null;}
}
function createRunner({environment,ledger,authorize,fetchImpl=globalThis.fetch,clock=()=>Date.now(),transport=sendNativeRequest}){
 const config=configuration(environment);
 if(!config||!ledger||!['claim','finish'].every(k=>typeof ledger[k]==='function')||typeof authorize!=='function')return null;
 const model=structuredClone(config.manifest);
 // Cached replies retain the original execution evidence. Validate that evidence
 // before reuse just as the live transport does; never manufacture fresh timing.
 const validCached=(result,input,inputHash)=>{
  const usage=result?.resourceUsage,measurement=result?.measurements,provenance=result?.provenance;
  return result?.status==='succeeded'&&result.code==='reply-requires-review'&&provenance?.operator==='DEMEOS'&&
   typeof provenance.at==='string'&&Number.isFinite(Date.parse(provenance.at))&&
   provenance.inputHash===inputHash&&provenance.workspaceId===input.workspaceId&&provenance.audience===input.audience&&
   ['modelId','modelVersion','runtimeCodeHash','weightsManifestHash','licenceReviewId','securityReviewId'].every(k=>provenance[k]===model[k])&&validateOutput(result.output)&&
   usage?.executions===1&&usage.retries===0&&Number.isFinite(usage.durationMs)&&usage.durationMs>=0&&usage.durationMs<LIMITS.timeoutMs&&
   usage.inputBytes===Buffer.byteLength(JSON.stringify(input))&&usage.outputBytes===Buffer.byteLength(JSON.stringify(result.output))&&
   Number.isFinite(measurement?.durationMs)&&measurement.durationMs>=0&&measurement.durationMs<=LIMITS.timeoutMs&&
   Number.isSafeInteger(measurement.peakVramBytes)&&measurement.peakVramBytes>=0;
 };
 return {async execute(request){
  const metrics={executions:0,retries:0,inputBytes:0,outputBytes:0,durationMs:0};
  const fail=(code,status='failed')=>({status,code,output:null,resourceUsage:{...metrics}});
  if(!validateInput(request))return fail('invalid-input','rejected');
  const input=structuredClone(request),inputHash=hash([CONTRACT,input,model]);
  const started=clock(),deadline=started+LIMITS.timeoutMs,controller=new AbortController();
  let claim,finished=false,attempted=false,received=false;
  const timeout=()=>Error('execution-timeout');
  const guard=()=>{if(controller.signal.aborted||clock()>=deadline)throw timeout();};
  const timer=setTimeout(()=>controller.abort(),LIMITS.timeoutMs);
  // Bound every await, including admission and reauthorisation. A late ledger
  // claim is never allowed to dispatch GPU work after this request has expired.
  const bounded=async operation=>{
   guard();let onAbort;
   const abort=new Promise((_,reject)=>{onAbort=()=>reject(timeout());controller.signal.addEventListener('abort',onAbort,{once:true});});
   try{const pending=Promise.resolve().then(()=>{guard();return operation();});const value=await Promise.race([pending,abort]);guard();return value;}
   finally{controller.signal.removeEventListener('abort',onAbort);}
  };
  const check=async()=>{try{return await authorize(structuredClone(input))===true;}catch{return false;}};
  const finish=async data=>{
   const saved=await ledger.finish({claimId:claim.claimId,inputHash,executions:metrics.executions,...data});
   const expected=data.result?'succeeded':data.uncertain?'uncertain':'failed';
   if(saved?.status!==expected)throw Error('ledger-finish-rejected');
   finished=true;
  };
  try{
   if(!await bounded(check))return fail('scope-revoked','rejected');
   const admission=Promise.resolve().then(()=>{guard();return ledger.claim({input,inputHash});}).then(value=>{
    // Preserve a late reservation safely; close it only as never dispatched.
    if((controller.signal.aborted||clock()>=deadline)&&value?.status==='claimed'&&value.claimId===input.requestId){
     Promise.resolve().then(()=>ledger.finish({claimId:value.claimId,inputHash,executions:0,code:'deadline-exceeded'})).catch(()=>{});
    }
    return value;
   });
   try{claim=await bounded(()=>admission);}catch(error){if(error.message==='execution-timeout')throw error;return fail('ledger-unavailable','unavailable');}
   if(claim?.status==='cached')return validCached(claim.result,input,inputHash)&&await bounded(check)?{...structuredClone(claim.result),cacheHit:true,reuseResourceUsage:metrics}:fail('invalid-cache');
   if(claim?.status!=='claimed')return fail(claim?.status==='conflict'?'request-conflict':'job-limit','limited');
   if(claim.claimId!==input.requestId)return fail('invalid-claim');
   if(!await bounded(check)){await bounded(()=>finish({code:'scope-revoked'}));return fail('scope-revoked','rejected');}
   guard();metrics.inputBytes=Buffer.byteLength(JSON.stringify(input));metrics.executions=1;attempted=true;
   // One dispatch through the same native transport/worker, without media URLs,
   // Selling roles, caller-selected models or hosted inference fallbacks.
   const body=await bounded(()=>{guard();return transport({config,input,inputHash,limits:LIMITS,deadline,signal:controller.signal,media:[],fetchImpl});});
   received=true;metrics.durationMs=Math.max(0,clock()-started);
   if(!validateOutput(body.output)){await bounded(()=>finish({code:'invalid-model-output'}));return fail('invalid-model-output');}
   if(!await bounded(check)){await bounded(()=>finish({code:'scope-revoked'}));return fail('scope-revoked','rejected');}
   metrics.durationMs=Math.max(0,clock()-started);metrics.outputBytes=Buffer.byteLength(JSON.stringify(body.output));
   const provenance={operator:'DEMEOS',modelId:model.modelId,modelVersion:model.modelVersion,runtimeCodeHash:model.runtimeCodeHash,weightsManifestHash:model.weightsManifestHash,licenceReviewId:model.licenceReviewId,securityReviewId:model.securityReviewId,inputHash,workspaceId:input.workspaceId,audience:input.audience,at:new Date(clock()).toISOString()};
   const result={status:'succeeded',code:'reply-requires-review',output:structuredClone(body.output),provenance,resourceUsage:{...metrics},measurements:structuredClone(body.measurements)};
   await bounded(()=>finish({result,code:'reply-requires-review'}));return result;
  }catch(error){
   metrics.durationMs=Math.max(0,clock()-started);
   const code=controller.signal.aborted||error.message==='execution-timeout'?'execution-timeout':'native-runtime-failed';
   // Cleanup is best effort and never extends the HTTP deadline. An unresolved
   // transport or ledger write retains the reservation; it cannot enable retries.
   if(claim?.status==='claimed'&&claim.claimId===input.requestId&&!finished){
    const cleanup=()=>finish({uncertain:attempted&&!received,code});
    if(controller.signal.aborted||clock()>=deadline)Promise.resolve().then(cleanup).catch(()=>{});
    else await bounded(cleanup).catch(()=>{});
   }
   return fail(code);
  }finally{clearTimeout(timer);controller.abort();}
 }};
}

function toWorkResult(input,execution){
 return {schemaVersion:1,requestId:input.requestId,engine:{kind:'native-root-text',version:'root-text-v1',modelExecuted:true,modelId:execution.provenance.modelId,modelVersion:execution.provenance.modelVersion},audience:input.audience,locale:input.outputLocale,source:{kind:'explicit-root-request',text:input.text,verified:false},literalCategoryEvidence:[],selectedCategory:null,checklist:[],conversation:{reply:execution.output.reply,verified:false,provenance:execution.provenance,resourceUsage:execution.resourceUsage,measurements:execution.measurements},limitations:['model-output-unverified','single-request-no-conversation-memory','no-tools-or-commercial-writeback'],review:{status:'pending',requiresUserCorrection:true},persistence:'none'};
}
module.exports={CONTRACT,LIMITS,LOCALES,configuration,createRunner,toWorkResult};
