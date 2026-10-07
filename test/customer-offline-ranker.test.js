const test=require('node:test'),assert=require('node:assert/strict');
const {buildTrainingDataset}=require('../api/_lib/customer-training-dataset');
const {prepareTrainingCandidate,validateTrainingResult}=require('../api/_lib/customer-training-candidate');
const {trainOfflineRanker,rankOfflineFeatures}=require('../api/_lib/customer-offline-ranker');
const {inputs}=require('./fixtures/customer-learning-fixture.cjs');
function job(){const dataset=buildTrainingDataset(inputs(60)).dataset;return prepareTrainingCandidate({dataset,datasetVersion:dataset.datasetVersion,baseIntelligenceVersion:'baseline-v1',purpose:'relevance-ranking'}).job;}
test('real offline toy training is reproducible, tested on held-out groups and never deploys',()=>{
 const a=trainOfflineRanker({job:job(),candidateVersion:'candidate-v1'}),b=trainOfflineRanker({job:job(),candidateVersion:'candidate-v1'});assert.equal(a.trained,true);assert.deepEqual(a,b);assert.equal(a.heldOutMetrics.test.mrr,1);assert.equal(a.heldOutMetrics.validation.mrr,1);assert.equal(a.artifact.productionDeploymentAllowed,false);
 assert.equal(rankOfflineFeatures(a.artifact,[{resultId:'bad',values:{exact_match:0,concept_match:0,preference_match:0}},{resultId:'good',values:{exact_match:1,concept_match:1,preference_match:0}}])[0].resultId,'good');
});
test('raw legacy evidence jobs cannot execute training',()=>{
 const legacy=prepareTrainingCandidate({records:[{signal:'selection',request:'jacket',learningConsent:true,verified:true}],baseIntelligenceVersion:'b',datasetVersion:'d'}).job;
 assert.equal(legacy.executionAllowed,false);assert.equal(trainOfflineRanker({job:legacy,candidateVersion:'c'}).trained,false);
});
test('training result is bound to dataset, purpose and base intelligence',()=>{
 const j=job(),valid={candidateIntelligenceVersion:'candidate-v1',datasetFingerprint:j.datasetFingerprint,datasetVersion:j.datasetVersion,baseIntelligenceVersion:j.baseIntelligenceVersion,purpose:j.purpose};
 assert.equal(validateTrainingResult({job:j,result:valid}).valid,true);assert.equal(validateTrainingResult({job:j,result:{...valid,purpose:'payment'}}).valid,false);
 j.datasetFingerprint='tampered';assert.equal(trainOfflineRanker({job:j,candidateVersion:'c'}).trained,false);
});
test('malformed offline feature rows fail closed',()=>{
 const model=trainOfflineRanker({job:job(),candidateVersion:'candidate-v1'}).artifact;
 assert.equal(rankOfflineFeatures(model,[null]),null);
 assert.equal(rankOfflineFeatures(model,[{resultId:'good',values:{exact_match:1,concept_match:1,preference_match:0,secret:1}}]),null);
});
