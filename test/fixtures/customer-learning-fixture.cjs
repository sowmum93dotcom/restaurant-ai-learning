const {groupEvidence}=require('../../api/_lib/customer-learning-labels');
function evidence(sourceType='customer', overrides={}) {
  const value={schemaVersion:2,evidenceId:'ev-'+sourceType, evidenceVersion:'ev-v1',sourceType,
    signal:{customer:'result_relevant',business:'relevance_claim',system:'search_execution',outcome:'verified_outcome'}[sourceType],
    searchId:'search-1',requestReference:'request-opaque-1',catalogueVersion:'catalogue-v1',intelligenceVersion:'baseline-v1',locale:'en',createdAt:'2026-10-07T00:00:00Z',
    permission:{decision:'approved',policyVersion:'privacy-v1',allowedPurposes:['relevance-ranking'],learningConsent:true,consentApplicability:'required'},
    verification:{state:'verified',method:'controlled-review',reference:'verification-1',trust:sourceType==='system'?'system-verified':'verified-source'},
    privacyClassification:'synthetic',retentionClassification:'training-window',assessment:sourceType==='system'?'observed':'relevant',resultIds:['good'],provenanceLinks:[],...overrides};
  if(sourceType==='business')value.businessApprovalStatus=overrides.businessApprovalStatus || 'Approved';
  if(sourceType==='system' && !overrides.system)value.system={eligibleIds:['bad','good'],rejectedIds:['blocked'],presentedIds:['good'],constraintsPassed:true,factIntegrityPassed:true,
    features:[{resultId:'bad',values:{exact_match:0,concept_match:0,preference_match:0}},{resultId:'good',values:{exact_match:1,concept_match:1,preference_match:0}}]};
  return value;
}
function decision(group, overrides={}) {return {approved:true,trust:'adjudicated',decisionId:'review-1',policyVersion:'labels-v1',reasonCode:'verified_relevance',resolvedEvidenceIds:group.evidence.map(e=>e.evidenceId),expectedResultIds:['good'],...overrides};}
function inputs(count=1) {
  const records=[];for(let i=0;i<count;i++)for(const type of ['customer','business','system','outcome'])records.push(evidence(type,{searchId:'search-'+i,requestReference:'request-'+i,evidenceId:'ev-'+type+'-'+i}));
  const groups=groupEvidence(records).groups;
  return {records,decisions:Object.fromEntries(groups.map(g=>[g.groupId,decision(g)])),datasetVersion:'dataset-v1',labelPolicyVersion:'labels-v1',createdAt:'2026-10-07T00:00:00Z',purpose:'relevance-ranking'};
}
module.exports={evidence,decision,inputs};
