'use strict';
const {FEATURES,fingerprint,id,plain,normalizeFeatures}=require('./customer-evidence-provenance');
const {validateTrainingDataset}=require('./customer-training-dataset');
// Auditable pointwise logistic relevance model. No provider, repository, HTTP,
// registration or deployment calls. Caller supplies a validated offline job.
function trainOfflineRanker({job,iterations=100,learningRate=0.1,candidateVersion}={}) {
  if(!job || job.executionAllowed!==true || job.productionDeploymentAllowed!==false || job.purpose!=='relevance-ranking' || !id(candidateVersion) || !validateTrainingDataset(job.dataset) || job.dataset.fingerprint!==job.datasetFingerprint || job.dataset.datasetVersion!==job.datasetVersion || !id(job.baseIntelligenceVersion))return {trained:false,reason:'controlled_training_job_required'};
  if(!Number.isInteger(iterations) || iterations<1 || iterations>200 || !Number.isFinite(learningRate) || learningRate<=0 || learningRate>1)return {trained:false,reason:'invalid_training_configuration'};
  if(!job.dataset.partitions.validation.length || !job.dataset.partitions.test.length)return {trained:false,reason:'held_out_partitions_required'};
  if(job.dataset.partitions.train.reduce((n,row)=>n+row.features.length,0)>10000)return {trained:false,reason:'training_feature_limit_exceeded'};
  const examples=job.dataset.partitions.train.flatMap(row=>row.features.map(feature=>({values:FEATURES.map(k=>feature.values[k]),label:row.expectedResultIds.includes(feature.resultId)?1:0})));
  if(examples.length<2 || !examples.some(x=>x.label===1) || !examples.some(x=>x.label===0))return {trained:false,reason:'positive_and_negative_training_features_required'};
  const weights=FEATURES.map(()=>0);let bias=0;
  for(let step=0;step<iterations;step++) {
    const gradient=FEATURES.map(()=>0);let offset=0;
    for(const example of examples){const z=bias+weights.reduce((sum,w,i)=>sum+w*example.values[i],0);const error=1/(1+Math.exp(-z))-example.label;offset+=error;example.values.forEach((v,i)=>{gradient[i]+=error*v;});}
    weights.forEach((w,i)=>{weights[i]=w-learningRate*gradient[i]/examples.length;});bias-=learningRate*offset/examples.length;
  }
  const artifact={schemaVersion:1,algorithm:'bounded-logistic-v1',purpose:job.purpose,candidateVersion,
    baseIntelligenceVersion:job.baseIntelligenceVersion,datasetVersion:job.datasetVersion,datasetFingerprint:job.datasetFingerprint,
    splitPolicy:job.dataset.splitPolicy,featureNames:FEATURES,weights,bias,iterations,learningRate,
    trainingExamples:examples.length,productionDeploymentAllowed:false};
  artifact.fingerprint=fingerprint(artifact);
  const heldOutMetrics=Object.fromEntries(['validation','test'].map(part=>{
    const reciprocal=job.dataset.partitions[part].map(row=>{
      const ranked=rankOfflineFeatures(artifact,row.features);
      const first=ranked.findIndex(x=>row.expectedResultIds.includes(x.resultId));
      return first<0?0:1/(first+1);
    });
    return [part,{groups:reciprocal.length,mrr:reciprocal.reduce((a,b)=>a+b,0)/reciprocal.length}];
  }));
  return {trained:true,artifact,heldOutMetrics,heldOutGroups:{validation:job.dataset.partitions.validation.length,test:job.dataset.partitions.test.length}};
}
function rankOfflineFeatures(artifact,rows) {
  if(!plain(artifact) || artifact.schemaVersion!==1 || artifact.algorithm!=='bounded-logistic-v1' || artifact.productionDeploymentAllowed!==false || artifact.purpose!=='relevance-ranking' || !Array.isArray(rows) || rows.length>200)return null;
  const {fingerprint:claimed,...payload}=artifact;
  if(claimed!==fingerprint(payload) || !Array.isArray(artifact.weights) || artifact.weights.length!==FEATURES.length || artifact.weights.some(x=>!Number.isFinite(x)) || !Number.isFinite(artifact.bias) || JSON.stringify(artifact.featureNames)!==JSON.stringify(FEATURES))return null;
  if(rows.some(row=>!plain(row) || !id(row.resultId)) || !normalizeFeatures(rows,rows.map(row=>row.resultId)))return null;
  return rows.map(row=>({resultId:row.resultId,score:1/(1+Math.exp(-(artifact.bias+FEATURES.reduce((sum,k,i)=>sum+artifact.weights[i]*row.values[k],0))))})).sort((a,b)=>b.score-a.score || a.resultId.localeCompare(b.resultId));
}
module.exports={trainOfflineRanker,rankOfflineFeatures};
