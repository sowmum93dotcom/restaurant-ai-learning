'use strict';
const crypto = require('node:crypto');
const LOCALES = Object.freeze(require('../../js/demeos-language-registry').languages.map(x => x.code));
const PURPOSES = Object.freeze(['relevance-ranking', 'query-understanding', 'attribute-extraction', 'semantic-retrieval', 'clarification', 'operational-metrics', 'aggregate-evaluation', 'personalized-learning']);
const TRUST = Object.freeze(['unverified', 'verified-source', 'cross-validated', 'system-verified', 'adjudicated']);
const SIGNALS = Object.freeze({
  customer: ['request', 'result_relevant', 'result_not_relevant', 'request_clarified', 'selection', 'save', 'continuation', 'correction'],
  business: ['published_information', 'catalogue_correction', 'relevance_claim', 'outcome_confirmation'],
  system: ['search_execution', 'constraint_evaluation', 'presentation', 'fact_integrity'],
  outcome: ['verified_outcome', 'verified_mismatch', 'resolved_search', 'confirmed_correction']
});
const FEATURES = Object.freeze(['exact_match', 'concept_match', 'preference_match']);
function plain(x) { return !!x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype; }
function id(x) { return typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x) ? x : null; }
function ids(x) { return Array.isArray(x) && x.length <= 200 && x.every(id) && new Set(x).size === x.length ? x.slice().sort() : null; }
function timestamp(x) { return typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().replace('.000Z','Z') === x.replace('.000Z','Z'); }
function canonical(x) { if (Array.isArray(x)) return x.map(canonical); if (plain(x)) return Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])); return x; }
function fingerprint(x) { return crypto.createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex'); }
function reject(reason) { return {accepted:false, reason}; }
function normalizeFeatures(rows, eligibleIds) {
  if (!Array.isArray(rows) || rows.length > 200 || new Set(rows.map(x=>x && x.resultId)).size !== rows.length) return null;
  const normalized=rows.map(row => {
    if (!plain(row) || !eligibleIds.includes(row.resultId) || !plain(row.values) || Object.keys(row.values).some(k=>!FEATURES.includes(k)) || FEATURES.some(k=>!Number.isFinite(row.values[k]) || row.values[k]<0 || row.values[k]>1)) return null;
    return {resultId:row.resultId, values:Object.fromEntries(FEATURES.map(k=>[k,row.values[k]]))};
  });
  return normalized.some(row=>!row)?null:normalized.sort((a,b)=>a.resultId.localeCompare(b.resultId));
}
// Trusted OFFLINE caller supplies verification and policy decisions. This parser
// validates their envelope; it does not authenticate a party or verify a claim.
function acceptEvidence(input, {purpose='relevance-ranking', minimumTrust='verified-source'}={}) {
  if (!plain(input) || input.schemaVersion!==2 || !PURPOSES.includes(purpose) || !TRUST.includes(minimumTrust)) return reject('invalid_contract');
  if (!SIGNALS[input.sourceType]?.includes(input.signal)) return reject('unsupported_source_signal');
  const p=input.permission, v=input.verification;
  if (!plain(p) || p.decision!=='approved' || !id(p.policyVersion) || !Array.isArray(p.allowedPurposes) || p.allowedPurposes.length>8 || p.allowedPurposes.some(x=>!PURPOSES.includes(x)) || !p.allowedPurposes.includes(purpose)) return reject('purpose_permission_required');
  if (!['synthetic','public-business','deidentified','aggregate'].includes(input.privacyClassification) || !['evaluation-window','training-window','aggregate-only'].includes(input.retentionClassification)) return reject('privacy_policy_required');
  if(input.retentionClassification==='aggregate-only' && !['operational-metrics','aggregate-evaluation'].includes(purpose))return reject('retention_scope_mismatch');
  if(input.sourceType==='business' && input.businessApprovalStatus!=='Approved')return reject('approved_business_source_required');
  const consentRequired=input.sourceType==='customer' || input.privacyClassification==='deidentified';
  if ((consentRequired || p.consentApplicability!=='policy-reviewed-not-applicable') && p.learningConsent!==true) return reject('learning_consent_required');
  if (!plain(v) || v.state!=='verified' || !id(v.method) || !id(v.reference) || !TRUST.includes(v.trust) || TRUST.indexOf(v.trust)<Math.max(1,TRUST.indexOf(minimumTrust))) return reject('verification_required');
  for (const key of ['evidenceId','searchId','requestReference','catalogueVersion','intelligenceVersion','evidenceVersion']) if (!id(input[key])) return reject('provenance_required');
  if (!LOCALES.includes(input.locale) || !timestamp(input.createdAt)) return reject('locale_or_timestamp_invalid');
  const resultIds=ids(input.resultIds || []), links=ids(input.provenanceLinks || []);
  if (!resultIds || !links || !['observed','relevant','irrelevant','unsupported','correction'].includes(input.assessment)) return reject('invalid_assessment');
  if (['selection','save','continuation','request'].includes(input.signal) && input.assessment!=='observed') return reject('behaviour_is_not_a_label');
  const evidence={schemaVersion:2, evidenceId:input.evidenceId, evidenceVersion:input.evidenceVersion,
    sourceType:input.sourceType, signal:input.signal, searchId:input.searchId, requestReference:input.requestReference,
    catalogueVersion:input.catalogueVersion, intelligenceVersion:input.intelligenceVersion, locale:input.locale,
    createdAt:input.createdAt, privacyClassification:input.privacyClassification, retentionClassification:input.retentionClassification,
    purpose, assessment:input.assessment, resultIds, provenanceLinks:links,
    permission:{decision:p.decision,policyVersion:p.policyVersion,allowedPurposes:[...new Set(p.allowedPurposes)].sort(),learningConsent:p.learningConsent===true,consentApplicability:p.consentApplicability || 'required'},
    verification:{state:v.state,method:v.method,reference:v.reference,trust:v.trust}};
  if(input.sourceType==='business')evidence.businessApprovalStatus='Approved';
  for(const key of ['evaluationId','sourceReference','businessDataVersion','interpretationVersion','rankingVersion']) {
    if (input[key]!==undefined) {if(!id(input[key]))return reject('invalid_optional_provenance');evidence[key]=input[key];}
  }
  if (input.sourceType==='system') {
    const s=input.system;
    if (!plain(s) || v.trust!=='system-verified') return reject('system_verification_required');
    const eligibleIds=ids(s.eligibleIds), rejectedIds=ids(s.rejectedIds), presentedIds=ids(s.presentedIds);
    if (!eligibleIds || !rejectedIds || !presentedIds || eligibleIds.some(x=>rejectedIds.includes(x)) || presentedIds.some(x=>!eligibleIds.includes(x)) || typeof s.constraintsPassed!=='boolean' || typeof s.factIntegrityPassed!=='boolean') return reject('invalid_system_snapshot');
    const features=normalizeFeatures(s.features || [],eligibleIds);
    if (!features || features.some(x=>!x)) return reject('invalid_features');
    evidence.system={eligibleIds,rejectedIds,presentedIds,constraintsPassed:s.constraintsPassed,factIntegrityPassed:s.factIntegrityPassed,features};
    if(s.clarificationAsked!==undefined){if(typeof s.clarificationAsked!=='boolean')return reject('invalid_system_snapshot');evidence.system.clarificationAsked=s.clarificationAsked;}
    if(s.rejectionReasons!==undefined){
      if(!Array.isArray(s.rejectionReasons) || s.rejectionReasons.length>200 || s.rejectionReasons.some(row=>!plain(row) || !rejectedIds.includes(row.resultId) || !ids(row.reasonCodes) || !row.reasonCodes.length) || new Set(s.rejectionReasons.map(row=>row.resultId)).size!==s.rejectionReasons.length)return reject('invalid_rejection_reasons');
      evidence.system.rejectionReasons=s.rejectionReasons.map(row=>({resultId:row.resultId,reasonCodes:ids(row.reasonCodes)})).sort((a,b)=>a.resultId.localeCompare(b.resultId));
    }
  }
  return {accepted:true, evidence};
}
module.exports={LOCALES,PURPOSES,TRUST,FEATURES,plain,id,ids,timestamp,canonical,fingerprint,normalizeFeatures,acceptEvidence};
