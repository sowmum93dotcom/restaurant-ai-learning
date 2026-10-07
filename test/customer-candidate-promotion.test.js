'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_SUITES, compareCandidate, approveCandidate } = require('../api/_lib/customer-candidate-promotion');

function suites() {
  return { suites: Object.fromEntries(REQUIRED_SUITES.map((name) => [name, { passed: true }])) };
}
const baseline = { relevance: 0.8, misleadingMatchRate: 0.1, unsupportedPrecision: 0.95, factIntegrity: 1 };
const candidate = { relevance: 0.9, misleadingMatchRate: 0.05, unsupportedPrecision: 0.98, factIntegrity: 1 };

test('candidate cannot pass when a required search evaluation suite fails', () => {
  const report = suites();
  report.suites.negation.passed = false;
  const result = compareCandidate({
    baselineVersion: 'search-v1', candidateVersion: 'search-v2',
    baselineMetrics: baseline, candidateMetrics: candidate, suiteReport: report
  });
  assert.equal(result.promotable, false);
  assert.deepEqual(result.failedSuites, ['negation']);
});

test('candidate must pass all suites and quality gates', () => {
  const result = compareCandidate({
    baselineVersion: 'search-v1', candidateVersion: 'search-v2',
    baselineMetrics: baseline, candidateMetrics: candidate, suiteReport: suites()
  });
  assert.equal(result.promotable, true);
  assert.equal(result.evaluationSuitesPassed, true);
});

test('promotion requires approval and a rollback to the exact baseline', () => {
  const comparison = compareCandidate({
    baselineVersion: 'search-v1', candidateVersion: 'search-v2',
    baselineMetrics: baseline, candidateMetrics: candidate, suiteReport: suites()
  });
  assert.equal(approveCandidate({ comparison, approvedBy: 'release-gate' }).approved, false);
  assert.equal(approveCandidate({
    comparison, approvedBy: 'release-gate', rollbackVersion: 'wrong-version'
  }).approved, false);
  const approved = approveCandidate({
    comparison, approvedBy: 'release-gate', rollbackVersion: 'search-v1'
  });
  assert.equal(approved.approved, true);
  assert.equal(approved.rollbackVersion, 'search-v1');
  assert.equal(approved.monitoringRequired, true);
});
test('versioned evaluation requires complete comparable evidence and zero hard-rule violations',()=>{
 const b={...baseline,hardConstraintViolationRate:0},c={...candidate,hardConstraintViolationRate:0};
 const report=(version,metrics)=>({...suites(),schemaVersion:1,valid:true,complete:true,safe:true,version,caseFingerprint:'judged-set-1',metrics});
 const params={baselineVersion:'search-v1',candidateVersion:'search-v2',baselineMetrics:b,candidateMetrics:c,suiteReport:report('search-v2',c),baselineReport:report('search-v1',b)};
 assert.equal(compareCandidate(params).promotable,true);
 assert.equal(compareCandidate({...params,suiteReport:{...params.suiteReport,complete:false}}).promotable,false);
 assert.equal(compareCandidate({...params,baselineReport:{...params.baselineReport,caseFingerprint:'different'}}).promotable,false);
 assert.equal(compareCandidate({...params,candidateMetrics:{...c,hardConstraintViolationRate:0.01},gates:{minRelevance:0}}).promotable,false);
});
test('better ranking cannot mask regression in recall or clarification quality',()=>{
 const {evaluateCandidate}=require('../api/_lib/customer-learning-pipeline');
 for(const metric of ['precision','recall','mrr','ndcg','clarificationAccuracy'])assert.equal(evaluateCandidate({baseline:{...baseline,[metric]:0.9},candidate:{...candidate,[metric]:0.8}}).promotable,false);
 assert.equal(evaluateCandidate({baseline,candidate:{...candidate,factIntegrity:0.99},gates:{minFactIntegrity:0}}).promotable,false);
});
