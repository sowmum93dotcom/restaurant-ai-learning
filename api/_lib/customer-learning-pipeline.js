'use strict';

/**
 * DEMEOS Customer Intelligence learning boundary.
 *
 * Search-time inference and model improvement are deliberately separated:
 * customer activity can create evidence, but it can never update production
 * intelligence directly. Only consented, validated, de-identified evidence can
 * enter a candidate dataset; candidate models/configurations must beat the
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
    ready: accepted.length > 0
  };
}

function evaluateCandidate({ baseline = {}, candidate = {}, gates = {} } = {}) {
  const required = ['relevance', 'misleadingMatchRate', 'unsupportedPrecision', 'factIntegrity'];
  const missing = required.filter((key) => !Number.isFinite(candidate[key]));
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
  if (candidate.relevance < minRelevance) failures.push('relevance');
  if (candidate.misleadingMatchRate > maxMisleading) failures.push('misleading_match_rate');
  if (candidate.unsupportedPrecision < minUnsupported) failures.push('unsupported_precision');
  if (candidate.factIntegrity < minIntegrity) failures.push('fact_integrity');

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
