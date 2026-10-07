'use strict';

const { buildLearningEvidence } = require('./customer-learning-pipeline');

const FEEDBACK_SIGNAL = Object.freeze({
  Relevant: 'result_relevant',
  'Not quite': 'result_not_relevant',
  'Something different': 'result_not_relevant'
});

function evidenceFromCustomerFeedback({
  feedback,
  request,
  resultIds,
  expectedResultIds,
  locale,
  evaluationId,
  learningConsent,
  verified
} = {}) {
  const signal = FEEDBACK_SIGNAL[feedback];
  if (!signal) return { accepted: false, reason: 'unsupported_feedback' };
  return buildLearningEvidence({
    signal,
    request,
    resultIds,
    expectedResultIds,
    locale,
    evaluationId,
    learningConsent,
    verified
  });
}

function evidenceFromSearchOutcome({
  outcome,
  request,
  resultIds,
  expectedResultIds,
  locale,
  evaluationId,
  learningConsent,
  verified
} = {}) {
  const supported = new Set(['selection', 'save', 'continuation', 'verified_outcome', 'unsupported_request', 'request_clarified']);
  if (!supported.has(outcome)) return { accepted: false, reason: 'unsupported_outcome' };
  return buildLearningEvidence({
    signal: outcome,
    request,
    resultIds,
    expectedResultIds,
    locale,
    evaluationId,
    learningConsent,
    verified
  });
}

// Versioned multi-party adapter for trusted offline importers; legacy adapters
// remain evidence-only and do not construct labels.
function evidenceFromParty(input, policy) { return require('./customer-evidence-provenance').acceptEvidence(input, policy); }
module.exports = { FEEDBACK_SIGNAL, evidenceFromCustomerFeedback, evidenceFromSearchOutcome, evidenceFromParty };
