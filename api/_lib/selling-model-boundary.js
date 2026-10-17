'use strict';
// No HTTP transport, model loader, environment flag or request-selected executor.
// A separately reviewed DEMEOS runtime must implement this contract and enforce
// the deadline/resource limits before any genuine weights may be executed.
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
module.exports={CONTRACT,availability,execute,validateResult};
