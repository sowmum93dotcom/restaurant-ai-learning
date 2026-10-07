'use strict';

/**
 * Offline training-candidate contract for DEMEOS Customer Intelligence.
 *
 * This module prepares versioned, reproducible training jobs. It does not call
 * a model provider and it cannot deploy a model. Provider execution belongs
 * behind an approved adapter; production promotion remains a separate gate.
 */

const { fingerprint } = require('./customer-evidence-provenance');
const { validateTrainingDataset } = require('./customer-training-dataset');
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
  return fingerprint(records.map(stableRecord));
}

function prepareTrainingCandidate({
  records = [],
  dataset,
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

  if (dataset !== undefined) {
    if (!validateTrainingDataset(dataset) || dataset.datasetVersion !== version || dataset.purpose !== safePurpose) return {ready:false,reason:'invalid_controlled_dataset'};
    return {ready:true,schemaVersion:2,job:{purpose:safePurpose,baseIntelligenceVersion:base,datasetVersion:version,
      datasetFingerprint:dataset.fingerprint,dataset,executionAllowed:true,productionDeploymentAllowed:false},rejected:[]};
  }
  const legacyDataset = buildCandidateDataset(records);
  if (!legacyDataset.ready) return { ready: false, reason: 'no_valid_training_evidence', rejected: legacyDataset.rejected };

  const trainingRecords = legacyDataset.records.map(stableRecord);
  return {
    ready: true,
    schemaVersion: 1,
    job: {
      purpose: safePurpose,
      executionAllowed: false,
      mode: 'evidence-inspection-only',
      baseIntelligenceVersion: base,
      datasetVersion: version,
      datasetFingerprint: stableFingerprint(trainingRecords),
      records: trainingRecords,
      productionDeploymentAllowed: false
    },
    rejected: legacyDataset.rejected
  };
}

function validateTrainingResult({ job, result } = {}) {
  if (!job || job.productionDeploymentAllowed !== false) {
    return { valid: false, reason: 'invalid_training_job' };
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { valid: false, reason: 'training_result_required' };
  }
  if (job.executionAllowed === true && (!validateTrainingDataset(job.dataset) || job.dataset.fingerprint !== job.datasetFingerprint || result.baseIntelligenceVersion !== job.baseIntelligenceVersion || result.datasetVersion !== job.datasetVersion || result.purpose !== job.purpose)) return {valid:false,reason:'training_binding_mismatch'};
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
