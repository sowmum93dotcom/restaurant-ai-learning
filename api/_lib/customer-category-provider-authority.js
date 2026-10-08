'use strict';
const {definitionSnapshot,definitionFingerprint}=require('./customer-category-provider-integration');
const {PURPOSE,BASELINE_VERSION,SCHEMA_VERSION}=require('./customer-category-understanding');
const {DATASET_VERSION}=require('./marketing-agent-categories');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const {DIMENSIONS,snapshotData}=require('./customer-category-reviewed-evaluation');
const {providerText}=require('./customer-search-understanding');
function record(value,fields){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==fields.length)return null;
 const copy={};for(const field of fields){const d=Object.getOwnPropertyDescriptor(value,field);if(!d||!Object.hasOwn(d,'value'))return null;copy[field]=d.value;}return copy;
}
function locales(value){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<1||value.length>LOCALES.length||Reflect.ownKeys(value).length!==value.length+1)return null;
 const copy=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!LOCALES.includes(d.value)||copy.includes(d.value))return null;copy.push(d.value);}return copy;
}
// readRecord is an authenticated, read-only SERVER dependency. Neither a
// provider nor an HTTP request can supply decisions or write this registry.
// No authority store is installed in production by this module.
function createCategoryProviderAuthority({definition,readRecord,now=Date.now,audience='offline-evaluation'}={}){
 const artifact=definitionSnapshot(definition),fp=definitionFingerprint(artifact);
 if(!['offline-evaluation','production'].includes(audience)||artifact.schemaVersion!==2||typeof readRecord!=='function'||typeof now!=='function')throw new Error('trusted_category_authority_required');
 async function read(kind,reference,signal){
  if(!id(reference)||!(signal instanceof AbortSignal)||signal.aborted)return null;
  const row=record(await readRecord(Object.freeze({kind,reference,signal})),['schemaVersion','decisionId','decision','kind','artifactFingerprint','purpose','audience','locales','expiresAt','payload']);
  const supported=row&&locales(row.locales),time=now();
  if(signal.aborted||!row||row.schemaVersion!==1||row.decisionId!==reference||row.decision!=='approved'||row.kind!==kind||row.artifactFingerprint!==fp||row.purpose!==PURPOSE||!['production','offline-evaluation'].includes(row.audience)||row.audience!==audience||!supported||!Number.isSafeInteger(row.expiresAt)||!Number.isSafeInteger(time)||row.expiresAt<=time)return null;
  return {...row,locales:supported};
 }
 async function resolveRelease(request){
  try{
   if(request.candidateVersion!==artifact.providerVersion||request.artifactFingerprint!==fp||request.purpose!==PURPOSE||request.rollbackVersion!==BASELINE_VERSION||!LOCALES.includes(request.locale)||!['customer-request','published-offer'].includes(request.scope))return null;
   const release=await read('provider-release',artifact.providerVersion,request.signal);
   if(!release||release.audience!==request.audience||!release.locales.includes(request.locale))return null;
   const p=record(release.payload,['providerIdentity','endpoint','modelVersion','configurationFingerprint','rollbackVersion','privacyReviewId','securityReviewId','evaluationReviewId','regressionReviewId','rollbackReviewId','activationDecisionId']);
   if(!p||p.providerIdentity!==artifact.providerIdentity||p.endpoint!==artifact.endpoint||p.modelVersion!==artifact.modelVersion||p.configurationFingerprint!==fp||p.rollbackVersion!==BASELINE_VERSION)return null;
   const requirements=['privacyReviewId','securityReviewId',...(request.audience==='production'?['evaluationReviewId','regressionReviewId','rollbackReviewId','activationDecisionId']:[])];
   for(const key of requirements){
    const review=await read(key,p[key],request.signal);
    if(!review||review.audience!==request.audience||!review.locales.includes(request.locale))return null;
    const receipt=record(review.payload,['rollbackVersion','configurationFingerprint','independentlyVerified','reportFingerprint','datasetFingerprint','realProviderOutputs']);
    if(!receipt||receipt.rollbackVersion!==BASELINE_VERSION||receipt.configurationFingerprint!==fp||receipt.independentlyVerified!==true)return null;
    if(key==='evaluationReviewId'){
     const verified=await read('evaluation-report',receipt.reportFingerprint,request.signal);
     if(!verified||verified.audience!==request.audience||!LOCALES.every(locale=>verified.locales.includes(locale)))return null;
     const report=verified.payload;
     if(receipt.realProviderOutputs!==true||!verifyCategoryProviderReport(report,{providerVersion:artifact.providerVersion,artifactFingerprint:fp,reportFingerprint:receipt.reportFingerprint,datasetFingerprint:receipt.datasetFingerprint}))return null;
    }
   }
   return Object.freeze({approved:true,candidateVersion:artifact.providerVersion,artifactFingerprint:fp,purpose:PURPOSE,rollbackVersion:BASELINE_VERSION,decisionId:release.decisionId,audience:request.audience,locale:request.locale,...Object.fromEntries(['privacyReviewId','securityReviewId','evaluationReviewId','regressionReviewId','rollbackReviewId','activationDecisionId'].map(key=>[key,p[key]]))});
  }catch(_error){return null;}
 }
 async function authorizeData(request){
  try{
   if(request.purpose!==PURPOSE||!LOCALES.includes(request.locale)||!['customer-request','published-offer'].includes(request.scope)||typeof request.text!=='string'||!request.text.trim()||request.text.length>(request.scope==='customer-request'?500:10000)||providerText(request.text)!==request.text)return null;
   const source=request.scope==='customer-request'?null:record(request.sourceReference,['workItemId','productId']);
   if(request.scope==='customer-request'?request.sourceReference!==null:(!source||!id(source.workItemId)||!id(source.productId)))return null;
   const expected=fingerprint({schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,text:request.text,locale:request.locale,scope:request.scope,sourceReference:source});
   if(request.requestFingerprint!==expected)return null;
   const decision=await read('source-policy',expected,request.signal);
   if(!decision||!decision.locales.includes(request.locale))return null;
   const p=record(decision.payload,['policyVersion','requestFingerprint','scope','sourceReference','dataMinimised','controlledTest','sourceVerified','learningExportAllowed']);
   if(!p||!id(p.policyVersion)||p.requestFingerprint!==expected||p.scope!==request.scope||fingerprint(p.sourceReference)!==fingerprint(source)||p.dataMinimised!==true||p.controlledTest!==false||p.sourceVerified!==true||p.learningExportAllowed!==false)return null;
   // Online purpose permission is not learning consent or export permission.
   return Object.freeze({allowed:true,purpose:PURPOSE,requestFingerprint:expected,policyVersion:p.policyVersion});
  }catch(_error){return null;}
 }
 return Object.freeze({resolveRelease,authorizeData});
}
function verifyCategoryProviderReport(report,binding){
 try{
  if(!report||Object.getPrototypeOf(report)!==Object.prototype)return false;
  const copy=snapshotData(report,250000),claimed=copy.reportFingerprint;delete copy.reportFingerprint;
  if(copy.schemaVersion!==1||copy.categoryDatasetVersion!==DATASET_VERSION||claimed!==binding.reportFingerprint||fingerprint(copy)!==claimed||copy.datasetFingerprint!==binding.datasetFingerprint||copy.providerVersion!==binding.providerVersion||copy.artifactFingerprint!==binding.artifactFingerprint||copy.independentlyReviewed!==true||copy.releaseGatePassed!==true)return false;
  if(!Array.isArray(copy.rows)||!copy.rows.length||copy.rows.length>1000||copy.rows.some(row=>row.status!=='correct-classification')||new Set(copy.rows.map(row=>row.caseId)).size!==copy.rows.length)return false;
  if(copy.counts['correct-classification']!==copy.rows.length||['incorrect-classification','unsafe-classification','safe-fallback'].some(key=>copy.counts[key]!==0)||copy.metrics.providerRejectedOrUnavailableCases!==0||copy.metrics.unsafeClassificationRate!==0||copy.metrics.providerAccuracy!==1)return false;
  return LOCALES.every(locale=>DIMENSIONS.every(dimension=>Number.isInteger(copy.evaluationCoverage?.[locale]?.[dimension])&&copy.evaluationCoverage[locale][dimension]>0)&&copy.localeMetrics[locale].cases===copy.rows.filter(row=>row.locale===locale).length&&copy.localeMetrics[locale].providerCases>0&&copy.localeMetrics[locale].providerAccuracy===1&&copy.localeMetrics[locale].unsafeClassificationRate===0);
 }catch(_error){return false;}
}
module.exports={createCategoryProviderAuthority,verifyCategoryProviderReport};
