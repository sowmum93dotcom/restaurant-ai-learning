'use strict';
const {randomUUID}=require('node:crypto');
const {acceptEvidence,fingerprint,plain,id,LOCALES}=require('./customer-evidence-provenance');
const {SCHEMA_VERSION}=require('./customer-search-intention');
const {deadline}=require('./customer-search-understanding');
function searchReference(work,locale='en'){
  return {searchId:randomUUID(),requestReference:randomUUID(),catalogueVersion:'snapshot-'+fingerprint(work),intelligenceVersion:require('./customer-search-registry').BASELINE_VERSION,interpretationVersion:SCHEMA_VERSION,locale:LOCALES.includes(locale)?locale:'en',createdAt:new Date().toISOString()};
}
async function emitSearchEvidence({configuration,reference,identity,testMode,possibilities,work,rejected=[],mode='baseline',shadowOrdering,visibleOrdering,candidateVersion,artifactFingerprint}={}){
  const policy=configuration?.evidence;
  if(testMode || !policy || typeof policy.authorize!=='function' || typeof policy.write!=='function')return {captured:false,reason:'evidence_disabled'};
  try{
    // Identity is passed only to the trusted policy service, never to records,
    // provider payloads, logs or training. No guidance flag supplies consent.
    const decision=await deadline(()=>policy.authorize({identity,searchId:reference.searchId,purpose:'relevance-ranking'}));
    if(!plain(decision))return {captured:false,reason:'permission_required'};
    const common={...reference,schemaVersion:2,evidenceVersion:'search-event-v1',permission:decision.permission,
      privacyClassification:decision.privacyClassification,retentionClassification:decision.retentionClassification,
      assessment:'observed',resultIds:possibilities.map(p=>p.possibilityId),provenanceLinks:[],
      verification:{state:'verified',method:'server-search-execution',reference:reference.searchId,trust:'system-verified'}};
    const eligibleIds=possibilities.map(p=>p.possibilityId);
    const system={...common,evidenceId:randomUUID(),sourceType:'system',signal:'search_execution',rankingVersion:configuration.baselineVersion,
      system:{eligibleIds,rejectedIds:rejected.map(r=>r.resultId),presentedIds:eligibleIds,constraintsPassed:true,factIntegrityPassed:true,
        rejectionReasons:rejected.map(r=>({resultId:r.resultId,reasonCodes:[r.reason]})),features:require('./customer-search-ranking').featureRows(possibilities),
        clarificationAsked:false,execution:{mode,baselineOrdering:eligibleIds,visibleOrdering:visibleOrdering || eligibleIds,...(shadowOrdering?{shadowOrdering}:{}),...(candidateVersion?{candidateVersion}:{}),...(artifactFingerprint?{artifactFingerprint}:{})}}};
    const records=[system];
    for(const p of possibilities){
      const source=decision.businessSources?.[p.workItemId];
      if(!work.some(w=>w.workItemId===p.workItemId)||!plain(source)||source.approvalStatus!=='Approved'||!id(source.verificationReference))continue;
      records.push({...common,evidenceId:randomUUID(),sourceType:'business',signal:'published_information',businessApprovalStatus:'Approved',sourceReference:p.workItemId,
        resultIds:[p.possibilityId],verification:{state:'verified',method:'approved-public-projection',reference:source.verificationReference,trust:'verified-source'}});
    }
    const checked=records.map(record=>acceptEvidence(record));
    if(checked.some(r=>!r.accepted))return {captured:false,reason:'evidence_gate_rejected'};
    await deadline(()=>policy.write(checked.map(r=>r.evidence)));
    return {captured:true,count:checked.length};
  }catch(_error){return {captured:false,reason:'evidence_unavailable'};}
}
// Existing authenticated action routes may link through a SERVER-OWNED resolver.
// Missing search provenance/explicit permission means no learning export.
async function emitCustomerAction({configuration,customerId,workItemId,signal,response}={}){
  const policy=configuration?.evidence;
  if(!policy||typeof policy.resolveInteraction!=='function'||typeof policy.authorize!=='function'||typeof policy.write!=='function')return {captured:false,reason:'action_link_unavailable'};
  try{
    const link=await deadline(()=>policy.resolveInteraction({customerId,workItemId}));
    if(!plain(link)||link.testMode!==false||!id(link.possibilityId))return {captured:false,reason:'verified_interaction_required'};
    const decision=await deadline(()=>policy.authorize({identity:{trustedCustomerIdentityId:customerId},searchId:link.reference?.searchId,purpose:'relevance-ranking'}));
    const assessment=signal==='result_relevant'?'relevant':signal==='result_not_relevant'?'irrelevant':'observed';
    const checked=acceptEvidence({...link.reference,schemaVersion:2,evidenceId:randomUUID(),evidenceVersion:'customer-action-v1',sourceType:'customer',signal,assessment,
      permission:decision?.permission,privacyClassification:decision?.privacyClassification,retentionClassification:decision?.retentionClassification,
      resultIds:[link.possibilityId],provenanceLinks:[],verification:{state:'verified',method:'authenticated-recorded-action',reference:link.reference?.searchId,trust:'verified-source'}});
    if(!checked.accepted)return {captured:false,reason:checked.reason};
    await deadline(()=>policy.write([checked.evidence]));return {captured:true};
  }catch(_error){return {captured:false,reason:'action_evidence_unavailable'};}
}
function queueCustomerAction(action){
  const registry=require('./customer-search-registry');
  const configuration=registry.getCustomerSearchConfiguration();
  if(!configuration.evidence)return;
  registry.scheduleCustomerSearch(registry.deferCustomerSearch,()=>emitCustomerAction({...action,configuration}));
}
module.exports={searchReference,emitSearchEvidence,emitCustomerAction,queueCustomerAction};
