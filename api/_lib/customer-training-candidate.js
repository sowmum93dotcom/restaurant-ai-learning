'use strict';

/**
 * Offline training-candidate contract for DEMEOS Customer Intelligence.
 *
 * This module prepares versioned, reproducible training jobs. It does not call
 * a model provider and it cannot deploy a model. Provider execution belongs
 * behind an approved adapter; production promotion remains a separate gate.
 */

const { buildCandidateDataset } = require('./customer-learning-pipeline');

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function stableRecord(record) {
  return {
    evaluationId: record.evaluationId || null,
    request: record.request,
    signal: record.signal,
    resultIds: Array.isArray(record.resultIds) ? record.resultIds.slice() : [],
    expectedResultIds: Array.isArray(record.expectedResultIds) ? record.expectedResultIds.slice() : [],
    locale: record.locale || null
  };
}

function stableFingerprint(records) {
  // FNV-1a is used only as a deterministic dataset identity, not security.
  const input = JSON.stringify(records.map(stableRecord));
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function prepareTrainingCandidate({
  records = [],
  baseIntelligenceVersion,
  datasetVersion,
  purpose = 'customer-search-relevance'
} = {}) {
  const base = clean(baseIntelligenceVersion, 128);
  const version = clean(datasetVersion, 128);
  const safePurpose = clean(purpose, 128);
  if (!base) return { ready: false, reason: 'base_intelligence_version_required' };
  if (!version) return { ready: false, reason: 'dataset_version_required' };
  if (!safePurpose) return { ready: false, reason: 'purpose_required' };

  const dataset = buildCandidateDataset(records);
  if (!dataset.ready) return { ready: false, reason: 'no_valid_training_evidence', rejected: dataset.rejected };

  const trainingRecords = dataset.records.map(stableRecord);
  return {
    ready: true,
    schemaVersion: 1,
    job: {
      purpose: safePurpose,
      baseIntelligenceVersion: base,
      datasetVersion: version,
      datasetFingerprint: stableFingerprint(trainingRecords),
      records: trainingRecords,
      productionDeploymentAllowed: false
    },
    rejected: dataset.rejected
  };
}

function validateTrainingResult({ job, result } = {}) {
  if (!job || job.productionDeploymentAllowed !== false) {
    return { valid: false, reason: 'invalid_training_job' };
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { valid: false, reason: 'training_result_required' };
  }
  const candidateVersion = clean(result.candidateIntelligenceVersion, 128);
  if (!candidateVersion) return { valid: false, reason: 'candidate_version_required' };
  if (result.datasetFingerprint !== job.datasetFingerprint) {
    return { valid: false, reason: 'dataset_fingerprint_mismatch' };
  }
  return {
    valid: true,
    candidateIntelligenceVersion: candidateVersion,
    datasetFingerprint: job.datasetFingerprint,
    productionDeploymentAllowed: false
  };
}

module.exports = { stableFingerprint, prepareTrainingCandidate, validateTrainingResult };
