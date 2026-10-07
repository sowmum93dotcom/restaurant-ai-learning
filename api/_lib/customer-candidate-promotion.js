'use strict';

const { evaluateCandidate, createPromotionDecision } = require('./customer-learning-pipeline');

const REQUIRED_SUITES = Object.freeze([
  'relevance',
  'misleading',
  'unsupported',
  'negation',
  'location',
  'multilingual',
  'fact-integrity'
]);

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateSuiteReport(report = {}) {
  const suites = report.suites && typeof report.suites === 'object' && !Array.isArray(report.suites)
    ? report.suites : {};
  const missing = REQUIRED_SUITES.filter((name) => !suites[name] || suites[name].passed !== true);
  return { passed: missing.length === 0, missing };
}

function compareCandidate({
  baselineVersion,
  candidateVersion,
  baselineMetrics,
  candidateMetrics,
  suiteReport,
  gates
} = {}) {
  const baseline = clean(baselineVersion, 128);
  const candidate = clean(candidateVersion, 128);
  if (!baseline || !candidate || baseline === candidate) {
    return { promotable: false, reason: 'distinct_versions_required' };
  }

  const suite = validateSuiteReport(suiteReport);
  if (!suite.passed) {
    return { promotable: false, reason: 'required_evaluation_suite_failed', failedSuites: suite.missing };
  }

  const quality = evaluateCandidate({ baseline: baselineMetrics, candidate: candidateMetrics, gates });
  return {
    ...quality,
    baselineVersion: baseline,
    candidateVersion: candidate,
    evaluationSuitesPassed: true
  };
}

function approveCandidate({ comparison, approvedBy, rollbackVersion } = {}) {
  const rollback = clean(rollbackVersion, 128);
  if (!rollback) return { approved: false, reason: 'rollback_version_required' };
  if (!comparison || comparison.baselineVersion !== rollback) {
    return { approved: false, reason: 'rollback_must_match_baseline' };
  }
  const decision = createPromotionDecision({ evaluation: comparison, approvedBy });
  if (!decision.approved) return decision;
  return {
    ...decision,
    candidateVersion: comparison.candidateVersion,
    rollbackVersion: rollback,
    monitoringRequired: true,
    automaticRollbackAllowed: true
  };
}

module.exports = { REQUIRED_SUITES, validateSuiteReport, compareCandidate, approveCandidate };
