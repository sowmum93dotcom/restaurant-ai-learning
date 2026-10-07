'use strict';
const {plain,id,ids,timestamp,fingerprint,PURPOSES,LOCALES,normalizeFeatures}=require('./customer-evidence-provenance');
const {groupEvidence,constructLearningLabel}=require('./customer-learning-labels');
const SPLIT_POLICY='interaction-sha256-80-10-10-v1';
function partition(groupId) {
  const bucket=parseInt(fingerprint({policy:SPLIT_POLICY,groupId}).slice(0,8),16)%100;
  return bucket<80?'train':bucket<90?'validation':'test';
}
function buildTrainingDataset({records,decisions,datasetVersion,labelPolicyVersion,createdAt,purpose='relevance-ranking'}={}) {
  if(!id(datasetVersion) || !id(labelPolicyVersion) || !timestamp(createdAt) || !PURPOSES.includes(purpose) || !plain(decisions))return {ready:false,reason:'versioned_dataset_metadata_required'};
  const grouped=groupEvidence(records,{purpose});
  if(!grouped.valid)return {ready:false,reason:grouped.reason};
  const labels=[],rejected=[...grouped.rejected];
  for(const group of grouped.groups){
    const decision=decisions[group.groupId];
    if(decision?.policyVersion!==labelPolicyVersion){rejected.push({reason:'label_policy_mismatch'});continue;}
    const result=constructLearningLabel(group,decision);
    if(!result.accepted){rejected.push({reason:result.reason});continue;}
    labels.push(result.label);
  }
  const partitions={train:[],validation:[],test:[]};
  labels.forEach(label=>partitions[partition(label.groupId)].push(label));
  const dataset={schemaVersion:2,evidenceSchemaVersion:2,labelSchemaVersion:1,datasetVersion,labelPolicyVersion,createdAt,purpose,splitPolicy:SPLIT_POLICY,
    sourceEvidenceVersions:labels.flatMap(x=>x.sourceEvidenceVersions).sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId)),
    partitions,counts:{sourceRecords:Array.isArray(records)?records.length:0,acceptedGroups:labels.length,rejected:rejected.length,train:partitions.train.length,validation:partitions.validation.length,test:partitions.test.length},
    productionDeploymentAllowed:false};
  dataset.fingerprint=fingerprint(dataset);
  return {ready:labels.length>0,dataset,rejected};
}
function validateTrainingDataset(dataset) {
  if(!plain(dataset) || dataset.schemaVersion!==2 || dataset.splitPolicy!==SPLIT_POLICY || dataset.productionDeploymentAllowed!==false || !plain(dataset.partitions))return false;
  if(!id(dataset.datasetVersion) || !id(dataset.labelPolicyVersion) || !timestamp(dataset.createdAt) || !PURPOSES.includes(dataset.purpose) || dataset.evidenceSchemaVersion!==2 || dataset.labelSchemaVersion!==1 || !Array.isArray(dataset.sourceEvidenceVersions) || !plain(dataset.counts))return false;
  if(Object.keys(dataset).some(k=>!['schemaVersion','evidenceSchemaVersion','labelSchemaVersion','datasetVersion','labelPolicyVersion','createdAt','purpose','splitPolicy','sourceEvidenceVersions','partitions','counts','productionDeploymentAllowed','fingerprint'].includes(k)) || Object.keys(dataset.partitions).sort().join(',')!=='test,train,validation' || Object.keys(dataset.counts).sort().join(',')!=='acceptedGroups,rejected,sourceRecords,test,train,validation' || Object.values(dataset.counts).some(n=>!Number.isInteger(n) || n<0) || dataset.sourceEvidenceVersions.length>10000 || dataset.sourceEvidenceVersions.some(v=>!plain(v) || Object.keys(v).sort().join(',')!=='evidenceId,evidenceVersion,schemaVersion' || !id(v.evidenceId) || !id(v.evidenceVersion) || v.schemaVersion!==2))return false;
  const {fingerprint:claimed,...payload}=dataset;
  if(!/^[a-f0-9]{64}$/.test(claimed || ''))return false;
  const seen=new Set();
  for(const part of ['train','validation','test']) {
    const rows=dataset.partitions[part];
    if(!Array.isArray(rows) || rows.length>10000 || rows.length!==dataset.counts?.[part])return false;
    for(const row of rows){
      if(!plain(row) || row.schemaVersion!==1 || !Array.isArray(row.sourceEvidenceVersions) || JSON.stringify(row.sourceEvidenceVersions)!==JSON.stringify(dataset.sourceEvidenceVersions.filter(v=>row.evidenceIds?.includes(v.evidenceId))) || Object.keys(row).some(k=>!['schemaVersion','groupId','requestReference','locale','purpose','evidenceIds','evidenceFingerprint','sourceEvidenceVersions','eligibleIds','expectedResultIds','features','policyVersion','decisionId','reasonCode','status','productionDeploymentAllowed'].includes(k)) || !id(row.requestReference) || !LOCALES.includes(row.locale) || !ids(row.eligibleIds) || !ids(row.expectedResultIds) || row.expectedResultIds.some(x=>!row.eligibleIds.includes(x)) || !ids(row.evidenceIds) || !id(row.decisionId) || row.productionDeploymentAllowed!==false || !normalizeFeatures(row.features,row.eligibleIds)?.every(Boolean))return false;
      if(!id(row.groupId) || !id(row.reasonCode) || !/^[a-f0-9]{64}$/.test(row.evidenceFingerprint || '') || seen.has(row.groupId) || partition(row.groupId)!==part || row.status!=='adjudicated' || row.policyVersion!==dataset.labelPolicyVersion || row.purpose!==dataset.purpose)return false;seen.add(row.groupId);}
  }
  return seen.size===dataset.counts.acceptedGroups && claimed===fingerprint(payload);
}
module.exports={SPLIT_POLICY,partition,buildTrainingDataset,validateTrainingDataset};
