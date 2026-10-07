'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stableFingerprint, prepareTrainingCandidate, validateTrainingResult } = require('../api/_lib/customer-training-candidate');

const evidence = [{
  signal: 'result_relevant',
  request: 'quiet family dinner tonight',
  resultIds: ['offer-1'],
  expectedResultIds: ['offer-1'],
  locale: 'en',
  evaluationId: 'eval-1',
  learningConsent: true,
  verified: true
}];

test('training candidate requires versioned base intelligence and dataset', () => {
  assert.equal(prepareTrainingCandidate({ records: evidence, datasetVersion: 'v1' }).ready, false);
  assert.equal(prepareTrainingCandidate({ records: evidence, baseIntelligenceVersion: 'search-v1' }).ready, false);
});

test('training candidate is reproducible and cannot self-deploy', () => {
  const first = prepareTrainingCandidate({
    records: evidence, baseIntelligenceVersion: 'search-v1', datasetVersion: 'evidence-v1'
  });
  const second = prepareTrainingCandidate({
    records: evidence, baseIntelligenceVersion: 'search-v1', datasetVersion: 'evidence-v1'
  });
  assert.equal(first.ready, true);
  assert.equal(first.job.datasetFingerprint, second.job.datasetFingerprint);
  assert.equal(first.job.productionDeploymentAllowed, false);
  assert.equal(first.job.records[0].createdAt, undefined);
});

test('training result must prove it used the expected dataset', () => {
  const candidate = prepareTrainingCandidate({
    records: evidence, baseIntelligenceVersion: 'search-v1', datasetVersion: 'evidence-v1'
  });
  assert.equal(validateTrainingResult({
    job: candidate.job,
    result: { candidateIntelligenceVersion: 'candidate-v2', datasetFingerprint: 'wrong' }
  }).valid, false);
  const valid = validateTrainingResult({
    job: candidate.job,
    result: { candidateIntelligenceVersion: 'candidate-v2', datasetFingerprint: candidate.job.datasetFingerprint }
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.productionDeploymentAllowed, false);
});

test('fingerprint changes when judged evidence changes', () => {
  assert.notEqual(stableFingerprint([{ request: 'a', signal: 'selection' }]),
    stableFingerprint([{ request: 'b', signal: 'selection' }]));
});
