'use strict';
// No HTTP transport, model loader, environment flag or request-selected executor.
// Only server composition may supply a reviewed DEMEOS runtime and durable ledger.
const {validateReference,DATASET_VERSION}=require('./marketing-agent-categories');
const CONTRACT=Object.freeze({schemaVersion:1,required:['modelId','modelVersion','capability','inputSchema','outputSchema','limits','provenance','resourceUsage'],inputSchema:'demeos-model-input-v1',outputSchema:'demeos-model-output-v1',limits:Object.freeze({timeoutMs:2000,maxInputBytes:32768,maxOutputBytes:32768,maxBatchSize:1}),capabilities:Object.freeze(['category-classification','image-semantics','video-semantics'])});
function availability(){return {available:false,code:'no-authorised-model',contract:CONTRACT};}
async function execute(){return {status:'unavailable',code:'no-authorised-model',output:null,resourceUsage:{executions:0}};}
function validateResult(value){
 try{
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||value.schemaVersion!==1||value.outputSchema!==CONTRACT.outputSchema||!['modelId','modelVersion'].every(key=>typeof value[key]==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value[key]))||!CONTRACT.capabilities.includes(value.capability)||value.provenance?.operator!=='DEMEOS'||typeof value.provenance?.licenceReviewId!=='string'||!/^[a-f0-9]{64}$/.test(value.provenance?.inputHash||'')||!Number.isFinite(value.resourceUsage?.durationMs)||value.resourceUsage.durationMs<0||value.resourceUsage.durationMs>CONTRACT.limits.timeoutMs||Buffer.byteLength(JSON.stringify(value))>CONTRACT.limits.maxOutputBytes)return false;
  // Semantic media output remains unsupported until a reviewed output schema
  // and independent verifier exist. A generic object cannot declare success.
  return value.capability==='category-classification'&&value.output?.datasetVersion===DATASET_VERSION&&Array.isArray(value.output.candidates)&&value.output.candidates.length<=8&&new Set(value.output.candidates.map(c=>c.categoryId)).size===value.output.candidates.length&&value.output.candidates.every(c=>validateReference(c));
 }catch{return false;}
}

const token=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const plain=v=>Boolean(v&&Object.getPrototypeOf(v)===Object.prototype);
const exact=(v,keys)=>plain(v)&&Object.keys(v).every(k=>keys.includes(k));
const outputLocales=Object.freeze([...require('../../js/demeos-language-registry').languages.map(l=>l.code),'tr']);
const VISUAL_CONTRACT=Object.freeze({schemaVersion:2,inputSchema:'demeos-visual-input-v2',outputSchema:'demeos-visual-output-v2',
 outputLocales,
 inputTypes:Object.freeze({'image-semantics':'image','video-frame-semantics':'sampled-video-frames'}),capabilities:Object.freeze(['image-semantics','video-frame-semantics']),
 limits:Object.freeze({timeoutMs:2000,maxInputBytes:32768,maxMediaBytes:4*1024*1024,maxOutputBytes:32768,maxFrames:4,maxOutputTokens:512,maxAttempts:2,maxJobsPerHour:20,maxConcurrentPerBusiness:1})});
const proposalKinds=Object.freeze(['title','description','category','observable-attribute','image-description','video-summary','media-consistency','visible-product','image-quality']);
function validateVisualInput(v){
 try{return exact(v,['schemaVersion','inputSchema','capability','businessId','productId','productRevision','mediaRevision','media','text','outputLocale'])&&(v.outputLocale===undefined||outputLocales.includes(v.outputLocale))&&v.schemaVersion===2&&v.inputSchema===VISUAL_CONTRACT.inputSchema&&VISUAL_CONTRACT.capabilities.includes(v.capability)&&token(v.businessId)&&token(v.productId)&&digest(v.productRevision)&&digest(v.mediaRevision)&&typeof v.text==='string'&&v.text.length<=2000&&Array.isArray(v.media)&&v.media.length>0&&v.media.length<=(v.capability==='image-semantics'?1:VISUAL_CONTRACT.limits.maxFrames)&&new Set(v.media.map(m=>m.assetId+':'+m.frameIndex)).size===v.media.length&&Array.from(v.media).every(m=>exact(m,['assetId','contentHash','sizeBytes','width','height','contentType','frameIndex','timestampSeconds'])&&token(m.assetId)&&digest(m.contentHash)&&Number.isSafeInteger(m.sizeBytes)&&m.sizeBytes>0&&Number.isSafeInteger(m.width)&&m.width>0&&m.width<=1600&&Number.isSafeInteger(m.height)&&m.height>0&&m.height<=1600&&['image/jpeg','image/png','image/webp'].includes(m.contentType)&&(v.capability==='image-semantics'?m.frameIndex===undefined&&m.timestampSeconds===undefined:Number.isSafeInteger(m.frameIndex)&&m.frameIndex>=0&&m.frameIndex<4&&Number.isFinite(m.timestampSeconds)&&m.timestampSeconds>=0&&m.timestampSeconds<=60))&&v.media.reduce((n,m)=>n+m.sizeBytes,0)<=VISUAL_CONTRACT.limits.maxMediaBytes&&Buffer.byteLength(JSON.stringify(v))<=VISUAL_CONTRACT.limits.maxInputBytes;}catch{return false;}
}
function validateVisualOutput(v,input){
 try{return exact(v,['schemaVersion','outputSchema','proposals'])&&v.schemaVersion===2&&v.outputSchema===VISUAL_CONTRACT.outputSchema&&Array.isArray(v.proposals)&&v.proposals.length<=16&&Buffer.byteLength(JSON.stringify(v))<=VISUAL_CONTRACT.limits.maxOutputBytes&&Array.from(v.proposals).every(p=>exact(p,['kind','value','evidence','confidence'])&&proposalKinds.includes(p.kind)&&Array.isArray(p.evidence)&&p.evidence.length>0&&p.evidence.length<=4&&Array.from(p.evidence).every(e=>input.media.some(m=>e===m.contentHash))&&p.confidence===null&&(p.kind==='category'?validateReference(p.value):typeof p.value==='string'&&p.value.trim().length>0&&p.value.length<=(p.kind==='title'?200:2000)&&!/[<>\u0000-\u0008]/.test(p.value)));}catch{return false;}
}
function reviewProposal(proposal,{actor,businessId,productId,productRevision,decision,value,now=new Date().toISOString()}){
 if(!token(actor)||proposal.businessId!==businessId||proposal.productId!==productId||proposal.productRevision!==productRevision||proposal.review.state!=='pending'||!['accepted','edited','rejected'].includes(decision))throw Error('invalid-proposal-review');
 const selected=decision==='edited'?value:proposal.value;
 if(decision==='edited'&&(proposal.kind==='category'?!validateReference(selected):typeof selected!=='string'||!selected.trim()||selected.length>(proposal.kind==='title'?200:2000)))throw Error('invalid-proposal-edit');
 // This returns review data only. The existing product editor/save/revision path
 // remains the sole authoring mechanism; no price, stock or publication writes.
 return {...proposal,review:{state:decision,actor,at:now,...(decision!=='rejected'?{value:selected}:{})}};
}
function createExecutionAdapter({manifest,runtime,authorize,ledger,clock=()=>Date.now()}={}){
 manifest=manifest?structuredClone(manifest):null;
 const l=VISUAL_CONTRACT.limits;
 const configured=plain(manifest)&&manifest.operator==='DEMEOS'&&token(manifest.modelId)&&token(manifest.modelVersion)&&token(manifest.licenceReviewId)&&token(manifest.securityReviewId)&&Array.isArray(manifest.capabilities)&&manifest.capabilities.length>0&&manifest.capabilities.every(c=>VISUAL_CONTRACT.capabilities.includes(c))&&runtime&&typeof runtime.execute==='function'&&typeof authorize==='function'&&ledger&&['claim','finish'].every(k=>typeof ledger[k]==='function');
 let outstanding=0;
 const unavailable=()=>({available:false,code:'no-authorised-model',contract:VISUAL_CONTRACT});
 return {
  availability:()=>configured?{available:true,modelId:manifest.modelId,modelVersion:manifest.modelVersion,capabilities:[...manifest.capabilities],contract:VISUAL_CONTRACT}:unavailable(),
  async execute(request,identity){
   const metrics={executions:0,retries:0,inputBytes:0,outputBytes:0,durationMs:0,estimatedComputeMs:0};
   const fail=(code,status='rejected')=>{metrics.errorCode=code;return {status,code,output:null,validation:'failed',resourceUsage:metrics};};
   if(!configured)return {...fail('no-authorised-model','unavailable'),validation:'unavailable'};
   if(!VISUAL_CONTRACT.capabilities.includes(request?.capability))return fail('unsupported-capability');
   if(!validateVisualInput(request))return fail('invalid-input');
   // Clone before any await so a caller cannot change scope or hash in flight.
   const input=structuredClone(request),model=structuredClone(manifest);
   if(!model.capabilities.includes(input.capability))return fail('unsupported-capability');
   const check=async()=>{try{return await authorize(identity,structuredClone(input))===true;}catch{return false;}};
   if(!await check())return fail('scope-or-revision-rejected');
   const inputHash=require('./selling-native-intelligence').hash([VISUAL_CONTRACT,input,model]);
   if(outstanding)return fail('runtime-busy','limited');
   const started=clock();
   let claim;try{claim=await ledger.claim({identity,input:structuredClone(input),inputHash,limits:l});}catch{return fail('ledger-unavailable','unavailable');}
   if(claim?.status==='cached'){
    const cached=claim.result;
    if(cached?.provenance?.inputHash===inputHash&&cached?.provenance?.modelId===model.modelId&&cached?.provenance?.modelVersion===model.modelVersion&&validateVisualOutput(cached.output,input)&&await check())return {...cached,cacheHit:true,resourceUsage:metrics};
    return fail('invalid-cache');
   }
   if(claim?.status!=='claimed'||!token(claim.claimId))return fail('job-already-claimed-or-budget-exceeded','limited');
   if(outstanding){await ledger.finish({claimId:claim.claimId,inputHash,terminal:true,metrics});return fail('runtime-busy','limited');}
   outstanding++;
   const controller=new AbortController();let pending=false,timer;
   metrics.inputBytes=Buffer.byteLength(JSON.stringify(input))+input.media.reduce((n,m)=>n+m.sizeBytes,0);
   try{
    const work=(async()=>{
     for(let attempt=0;attempt<l.maxAttempts;attempt++){
      if(controller.signal.aborted)throw Error('execution-timeout');
      metrics.executions++;metrics.retries=attempt;
      try{return await runtime.execute({input:structuredClone(input),inputHash,model,limits:l,deadline:started+l.timeoutMs,signal:controller.signal});}
      catch(error){if(controller.signal.aborted||error?.code!=='TRANSIENT'||attempt===l.maxAttempts-1)throw error;}
     }
    })();
    pending=true;work.finally(()=>{pending=false;outstanding--;}).catch(()=>{});
    const raw=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('execution-timeout'));},l.timeoutMs);})]);
    if(clock()-started>l.timeoutMs)return fail('execution-timeout','failed');
    if(!validateVisualOutput(raw,input))return fail('invalid-model-output','failed');
    if(!await check())return fail('scope-or-revision-rejected');
    const at=new Date(clock()).toISOString();metrics.outputBytes=Buffer.byteLength(JSON.stringify(raw));
    const provenance={operator:'DEMEOS',modelId:model.modelId,modelVersion:model.modelVersion,licenceReviewId:model.licenceReviewId,securityReviewId:model.securityReviewId,inputHash,businessId:input.businessId,productId:input.productId,productRevision:input.productRevision,mediaRevision:input.mediaRevision,at};
    metrics.durationMs=Math.max(0,clock()-started);metrics.estimatedComputeMs=metrics.durationMs; // wall-time upper estimate, not measured GPU time
    const result={status:'succeeded',code:'suggestions-require-review',validation:'schema-valid-unverified',output:structuredClone(raw),provenance,resourceUsage:{...metrics},proposals:raw.proposals.map((p,index)=>({...p,proposalId:inputHash+':'+index,source:'model',modelId:model.modelId,modelVersion:model.modelVersion,businessId:input.businessId,productId:input.productId,mediaRevision:input.mediaRevision,productRevision:input.productRevision,at,review:{state:'pending'}}))};
    await ledger.finish({claimId:claim.claimId,inputHash,result});return result;
   }catch(error){return fail(error?.message==='execution-timeout'?'execution-timeout':'model-execution-failed','failed');}
   finally{
    clearTimeout(timer);controller.abort();metrics.durationMs=Math.max(0,clock()-started);metrics.estimatedComputeMs=metrics.durationMs;
    // A runtime ignoring abort keeps this adapter busy; never start overlapping
    // work. Durable ledger retains timed-out claims for operator reconciliation.
    if(!pending)await ledger.finish({claimId:claim.claimId,inputHash,metrics,terminal:true}).catch(()=>{});
   }
  }
 };
}
module.exports={CONTRACT,VISUAL_CONTRACT,availability,execute,validateResult,validateVisualInput,validateVisualOutput,createExecutionAdapter,reviewProposal};
