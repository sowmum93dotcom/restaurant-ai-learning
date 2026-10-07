'use strict';

/**
 * DEMEOS Customer Intelligence learning boundary.
 *
 * Search-time inference and model improvement are deliberately separated:
 * customer activity can create evidence, but it can never update production
 * intelligence directly. Legacy records are inspection-only; version 2
 * adjudicated datasets are required for training. Candidate models must beat the
 * approved baseline and pass integrity gates before an explicit promotion.
 */

const ALLOWED_SIGNALS = new Set([
  'result_relevant',
  'result_not_relevant',
  'request_clarified',
  'unsupported_request',
  'selection',
  'save',
  'continuation',
  'verified_outcome'
]);

function cleanText(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function buildLearningEvidence(input = {}) {
  if(!input || typeof input!=='object' || Array.isArray(input))return {accepted:false,reason:'invalid_evidence'};
  const signal = cleanText(input.signal, 64);
  if (!ALLOWED_SIGNALS.has(signal)) return { accepted: false, reason: 'unsupported_signal' };
  if (input.learningConsent !== true) return { accepted: false, reason: 'learning_consent_required' };
  if (input.verified !== true) return { accepted: false, reason: 'verification_required' };

  const request = cleanText(input.request);
  if (!request) return { accepted: false, reason: 'request_required' };

  // Never place account identity, contact details, payment data or raw private
  // profile data in the learning record. Stable opaque evaluation IDs are
  // allowed only when supplied by the controlled pipeline.
  const evidence = {
    schemaVersion: 1,
    evaluationId: cleanText(input.evaluationId, 128) || null,
    request,
    signal,
    resultIds: Array.isArray(input.resultIds)
      ? input.resultIds.map((id) => cleanText(id, 128)).filter(Boolean).slice(0, 50)
      : [],
    expectedResultIds: Array.isArray(input.expectedResultIds)
      ? input.expectedResultIds.map((id) => cleanText(id, 128)).filter(Boolean).slice(0, 50)
      : [],
    locale: cleanText(input.locale, 32) || null,
    createdAt: input.createdAt || new Date().toISOString(),
    source: 'customer_intelligence_evidence'
  };

  return { accepted: true, evidence };
}

function buildCandidateDataset(records = []) {
  if(!Array.isArray(records) || records.length>10000)return {schemaVersion:1,records:[],rejected:[{reason:'bounded_records_required'}],supervisedTrainingAllowed:false,ready:false};
  const accepted = [];
  const rejected = [];
  for (const record of records) {
    const result = buildLearningEvidence(record);
    if (result.accepted) accepted.push(result.evidence);
    else rejected.push({ evaluationId: cleanText(record && record.evaluationId, 128) || null, reason: result.reason });
  }
  return {
    schemaVersion: 1,
    records: accepted,
    rejected,
    supervisedTrainingAllowed: false,
    ready: accepted.length > 0
  };
}

function evaluateCandidate({ baseline = {}, candidate = {}, gates = {} } = {}) {
  const required = ['relevance', 'misleadingMatchRate', 'unsupportedPrecision', 'factIntegrity'];
  const missing = required.filter((key) => !Number.isFinite(candidate[key]));
  if (candidate.hardConstraintViolationRate !== undefined && candidate.hardConstraintViolationRate !== 0) return {promotable:false,reason:'hard_constraint_violation'};
  if (required.some(key => Number.isFinite(candidate[key]) && (candidate[key]<0 || candidate[key]>1))) return {promotable:false,reason:'invalid_metric_range'};
  if (missing.length) return { promotable: false, reason: 'missing_metrics', missing };

  const baselineRelevance = Number.isFinite(baseline.relevance) ? baseline.relevance : 0;
  const baselineMisleading = Number.isFinite(baseline.misleadingMatchRate) ? baseline.misleadingMatchRate : 1;
  const baselineUnsupported = Number.isFinite(baseline.unsupportedPrecision) ? baseline.unsupportedPrecision : 0;
  const baselineIntegrity = Number.isFinite(baseline.factIntegrity) ? baseline.factIntegrity : 0;

  const minRelevance = Number.isFinite(gates.minRelevance) ? gates.minRelevance : baselineRelevance;
  const maxMisleading = Number.isFinite(gates.maxMisleadingMatchRate) ? gates.maxMisleadingMatchRate : baselineMisleading;
  const minUnsupported = Number.isFinite(gates.minUnsupportedPrecision) ? gates.minUnsupportedPrecision : baselineUnsupported;
  const minIntegrity = Number.isFinite(gates.minFactIntegrity) ? gates.minFactIntegrity : Math.max(baselineIntegrity, 1);

  const failures = [];
  if (candidate.relevance < Math.max(minRelevance, baselineRelevance)) failures.push('relevance');
  if (candidate.misleadingMatchRate > Math.min(maxMisleading, baselineMisleading)) failures.push('misleading_match_rate');
  if (candidate.unsupportedPrecision < Math.max(minUnsupported, baselineUnsupported)) failures.push('unsupported_precision');
  if (candidate.factIntegrity !== 1 || candidate.factIntegrity < minIntegrity) failures.push('fact_integrity');
  for(const key of ['precision','recall','mrr','ndcg','clarificationAccuracy']) {
    if(baseline[key]!==undefined && (!Number.isFinite(baseline[key]) || baseline[key]<0 || baseline[key]>1 || !Number.isFinite(candidate[key]) || candidate[key]<baseline[key] || candidate[key]>1)) failures.push(key);
  }

  return {
    promotable: failures.length === 0,
    reason: failures.length ? 'quality_gate_failed' : 'quality_gates_passed',
    failures,
    requiresExplicitApproval: true
  };
}

function createPromotionDecision({ evaluation, approvedBy } = {}) {
  if (!evaluation || evaluation.promotable !== true) {
    return { approved: false, reason: 'candidate_not_promotable' };
  }
  const approver = cleanText(approvedBy, 128);
  if (!approver) return { approved: false, reason: 'explicit_approval_required' };
  return {
    approved: true,
    approvedBy: approver,
    decision: 'promote_candidate',
    automaticProductionLearning: false
  };
}

module.exports = {
  ALLOWED_SIGNALS,
  buildLearningEvidence,
  buildCandidateDataset,
  evaluateCandidate,
  createPromotionDecision
};
