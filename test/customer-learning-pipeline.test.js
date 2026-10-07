'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildLearningEvidence,
  buildCandidateDataset,
  evaluateCandidate,
  createPromotionDecision
} = require('../api/_lib/customer-learning-pipeline');

test('learning evidence requires consent and verification', () => {
  assert.equal(buildLearningEvidence({ signal: 'selection', request: 'black jacket', verified: true }).accepted, false);
  assert.equal(buildLearningEvidence({ signal: 'selection', request: 'black jacket', learningConsent: true }).accepted, false);
});

test('learning record keeps search evidence but excludes arbitrary private fields', () => {
  const result = buildLearningEvidence({
    signal: 'result_relevant',
    request: 'quiet family dinner tonight',
    learningConsent: true,
    verified: true,
    resultIds: ['offer-1'],
    email: 'private@example.com',
    paymentCard: 'never-store-this'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.evidence.request, 'quiet family dinner tonight');
  assert.equal(result.evidence.email, undefined);
  assert.equal(result.evidence.paymentCard, undefined);
});

test('candidate dataset rejects unsupported or unverified signals', () => {
  const dataset = buildCandidateDataset([
    { signal: 'result_relevant', request: 'camping tent', learningConsent: true, verified: true },
    { signal: 'unknown', request: 'camping tent', learningConsent: true, verified: true }
  ]);
  assert.equal(dataset.records.length, 1);
  assert.equal(dataset.rejected.length, 1);
});

test('candidate cannot promote when integrity or relevance gates fail', () => {
  const evaluation = evaluateCandidate({
    baseline: { relevance: 0.8, misleadingMatchRate: 0.1, unsupportedPrecision: 0.95, factIntegrity: 1 },
    candidate: { relevance: 0.9, misleadingMatchRate: 0.05, unsupportedPrecision: 0.98, factIntegrity: 0.99 }
  });
  assert.equal(evaluation.promotable, false);
  assert.deepEqual(evaluation.failures, ['fact_integrity']);
});

test('passing candidate still requires explicit promotion approval', () => {
  const evaluation = evaluateCandidate({
    baseline: { relevance: 0.8, misleadingMatchRate: 0.1, unsupportedPrecision: 0.95, factIntegrity: 1 },
    candidate: { relevance: 0.9, misleadingMatchRate: 0.05, unsupportedPrecision: 0.98, factIntegrity: 1 }
  });
  assert.equal(evaluation.promotable, true);
  assert.equal(createPromotionDecision({ evaluation }).approved, false);
  assert.equal(createPromotionDecision({ evaluation, approvedBy: 'demeos-release-gate' }).approved, true);
});
