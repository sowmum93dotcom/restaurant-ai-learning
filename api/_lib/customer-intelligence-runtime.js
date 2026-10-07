'use strict';
const {runCustomerIntelligence,applyIntelligenceRanking}=require('./customer-intelligence-interface');
const {id,plain}=require('./customer-evidence-provenance');
// Server-owned offline-approved registry only. No environment switch or customer
// supplied boolean can authorize a model. This module is not wired to HTTP.
async function runIntelligenceRuntime({mode='baseline',baselineVersion,candidateVersion,purpose='relevance-ranking',provider,request,possibilities=[],rankingCandidates,resolveApproval,timeoutMs=250}={}) {
  const baseline=Array.isArray(possibilities)?possibilities.slice():[];
  const fallback=reason=>({possibilities:baseline,modeApplied:'baseline',diagnostic:{reason}});
  if(!id(baselineVersion) || !['baseline','shadow','candidate'].includes(mode) || purpose!=='relevance-ranking')return fallback('invalid_runtime_configuration');
  if(mode==='baseline')return fallback('approved_baseline');
  if(!id(candidateVersion) || candidateVersion===baselineVersion)return fallback('distinct_candidate_required');
  if(mode==='candidate') {
    let approval,timer;
    const deadline=Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=5000?timeoutMs:250;
    try {approval=typeof resolveApproval==='function'?await Promise.race([Promise.resolve().then(()=>resolveApproval(candidateVersion)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('approval_timeout')),deadline);})]):null;}catch(_error){return fallback('approval_unavailable');}finally{clearTimeout(timer);}
    if(!plain(approval) || approval.approved!==true || approval.candidateVersion!==candidateVersion || approval.rollbackVersion!==baselineVersion || approval.purpose!==purpose || !id(approval.decisionId) || !/^[a-f0-9]{64}$/.test(approval.artifactFingerprint || '') || provider?.intelligenceVersion!==candidateVersion || provider?.artifactFingerprint!==approval.artifactFingerprint)return fallback('candidate_approval_required');
  }
  if(rankingCandidates && (!Array.isArray(rankingCandidates) || rankingCandidates.length!==baseline.length || rankingCandidates.some(c=>!c || !baseline.some(p=>p.possibilityId===c.possibilityId && p.workItemId===c.workItemId))))return fallback('invalid_ranking_projection');
  const result=await runCustomerIntelligence({provider,request,candidates:rankingCandidates || baseline,timeoutMs});
  if(!result.used)return fallback(result.reason);
  if(mode==='shadow')return {possibilities:baseline,modeApplied:'shadow',diagnostic:{reason:'shadow_only',candidateVersion,rankedIds:applyIntelligenceRanking(baseline,result).map(x=>x.possibilityId)}};
  return {possibilities:applyIntelligenceRanking(baseline,result),modeApplied:'candidate',diagnostic:{reason:'approved_candidate',candidateVersion,rollbackVersion:baselineVersion}};
}
function monitoringDecision({metrics,rollbackVersion,baselineVersion}={}) {
  if(!id(rollbackVersion) || rollbackVersion!==baselineVersion)return {valid:false,reason:'valid_rollback_baseline_required'};
  if(!plain(metrics) || ['hardConstraintViolationRate','factIntegrity'].some(k=>!Number.isFinite(metrics[k]) || metrics[k]<0 || metrics[k]>1))return {valid:false,reason:'monitoring_evidence_required'};
  return {valid:true,rollbackRequired:metrics.hardConstraintViolationRate!==0 || metrics.factIntegrity!==1,rollbackVersion,automaticProductionMutation:false};
}
module.exports={runIntelligenceRuntime,monitoringDecision};
