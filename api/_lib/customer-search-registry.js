'use strict';
// Server-owned configuration. No request/query/header/environment boolean can
// install a provider, authorize training, or activate an intelligence artifact.
const BASELINE_VERSION='demeos-deterministic-search-v1';
const SAFE_CONFIGURATION=Object.freeze({mode:'baseline',baselineVersion:BASELINE_VERSION,understanding:null,categoryUnderstanding:null,provider:null,artifact:null,evidence:null});
function getCustomerSearchConfiguration(){return SAFE_CONFIGURATION;}
function deferCustomerSearch(task){
  // Vercel keeps the invocation alive; no untracked fire-and-forget work.
  const {waitUntil}=require('@vercel/functions');
  waitUntil(task.catch(()=>undefined));
}
function scheduleCustomerSearch(defer,operation){
  if(typeof defer!=='function')return false;
  let registered=false;
  const task=Promise.resolve().then(()=>registered?operation():undefined).catch(()=>undefined);
  try{defer(task);registered=true;return true;}catch(_error){return false;}
}
module.exports={BASELINE_VERSION,getCustomerSearchConfiguration,deferCustomerSearch,scheduleCustomerSearch};
