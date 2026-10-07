'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareCustomerSearch,completeCustomerSearch}=require('../api/_lib/customer-search-service');
const {rankingCandidates,validateRankingEvidence,offlineShadowProvider,FEATURE_POLICY}=require('../api/_lib/customer-search-ranking');
const {getCustomerSearchConfiguration,BASELINE_VERSION}=require('../api/_lib/customer-search-registry');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {findCustomerPossibilities}=require('../api/_lib/customer-possibility-contract');
const {inputs}=require('./fixtures/customer-learning-fixture.cjs');
const {buildTrainingDataset}=require('../api/_lib/customer-training-dataset');
const {prepareTrainingCandidate}=require('../api/_lib/customer-training-candidate');
const {trainOfflineRanker}=require('../api/_lib/customer-offline-ranker');
function confirmed(text){return confirmCustomerUnderstanding(buildCustomerUnderstanding('',text));}
function work(id='a',description='Black waterproof jacket',price='£89',location='Manchester'){
 return {workItemId:id,businessId:'business-'+id,businessName:'Approved business',content:description,participationAction:'Interested',location,token:'secret',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:'Black jacket',description,price,availability:'available',continuationRoute:'website',adminSecret:'secret'}]};
}
async function search(query='jacket',catalogue=[work('a'),work('b')],configuration=getCustomerSearchConfiguration()){
 const understanding=confirmed(query),prepared=await prepareCustomerSearch({understanding,work:catalogue,configuration});return {understanding,prepared,work:catalogue,configuration,possibilities:prepared.possibilities};
}
test('baseline preserves original deterministic order and default configuration installs no provider',async()=>{
 const state=await search();assert.deepEqual(state.possibilities,findCustomerPossibilities(state.understanding,state.work));assert.deepEqual(await completeCustomerSearch(state),state.possibilities);assert.equal(state.configuration.mode,'baseline');assert.equal(state.configuration.provider,null);
});
test('hard black/waterproof/exclusion/budget/location checks precede the result cap and cannot be ranked away',async()=>{
 const s=await search('waterproof black jacket, not blue, under £100',[work('blue','Blue waterproof jacket'),work('expensive','Black waterproof jacket','£160'),work('cheap')]);assert.deepEqual(s.possibilities.map(p=>p.workItemId),['cheap']);
 const capped=await search('black jacket under £100',[...Array.from({length:6},(_,i)=>work('costly-'+i,'Black jacket','£160')),work('cheap')]);assert.deepEqual(capped.possibilities.map(p=>p.workItemId),['cheap']);
 assert.deepEqual((await search('black jacket near Manchester',[work('london','Black jacket','£89','London'),work('local','Black jacket')])).possibilities.map(p=>p.workItemId),['local']);
 assert.deepEqual((await search('jacket tomorrow')).possibilities,[]);assert.deepEqual((await search('jacket within 2 km')).possibilities,[]);
 assert.deepEqual((await search('no quiet dinner',[work('quiet','Quiet dinner')])).possibilities,[]);
});
test('unsupported and unavailable information never fabricates results',async()=>{
 assert.deepEqual((await search('spaceship launch')).possibilities,[]);
 const unavailable=work();unavailable.products[0].availability='unavailable';unavailable.content='Something else';assert.deepEqual((await search('jacket',[unavailable])).possibilities,[]);
});
test('shadow response does not wait for its provider and cannot change visible order',async()=>{
 const tasks=[];let release,called=false;const gate=new Promise(resolve=>release=resolve);
 const s=await search('jacket',undefined,{...getCustomerSearchConfiguration(),mode:'shadow',allowProviderRequest:true,provider:{intelligenceVersion:'shadow-v1',rank:async input=>{called=true;await gate;return {ranked:input.candidates.slice().reverse().map((c,i)=>({possibilityId:c.possibilityId,score:1-i*.1}))};}}});
 const visible=await completeCustomerSearch({...s,defer:task=>tasks.push(task)});assert.deepEqual(visible,s.possibilities);assert.equal(tasks.length,1);release();await Promise.all(tasks);assert.equal(called,true);
});
test('candidate needs artifact-bound approval and reorders only issued eligible objects',async()=>{
 const provider={intelligenceVersion:'rank-v1',artifactFingerprint:'a'.repeat(64),rank:async input=>({ranked:input.candidates.slice().reverse().map((c,i)=>({possibilityId:c.possibilityId,score:1-i*.1}))})};
 const s=await search('jacket',undefined,{...getCustomerSearchConfiguration(),mode:'candidate',allowProviderRequest:true,provider});
 assert.deepEqual(await completeCustomerSearch(s),s.possibilities);
 const approved={...s,configuration:{...s.configuration,resolveApproval:async()=>({approved:true,candidateVersion:'rank-v1',purpose:'relevance-ranking',decisionId:'approval-1',rollbackVersion:BASELINE_VERSION,artifactFingerprint:provider.artifactFingerprint})}};
 assert.deepEqual((await completeCustomerSearch(approved)).map(p=>p.workItemId),s.possibilities.slice().reverse().map(p=>p.workItemId));
});
test('unknown, duplicate, malformed, failed and timed-out rankings fall back without new facts',async()=>{
 const s=await search();
 for(const rank of [async()=>({ranked:[{possibilityId:'invented',score:1}]}),async input=>({ranked:[{possibilityId:input.candidates[0].possibilityId,score:1},{possibilityId:input.candidates[0].possibilityId,score:.9}]}),async()=>{throw Error('down');},async()=>new Promise(()=>{}),async()=>({ranked:'bad'})]){
  const tasks=[];assert.deepEqual(await completeCustomerSearch({...s,configuration:{...s.configuration,mode:'shadow',timeoutMs:5,allowProviderRequest:true,provider:{intelligenceVersion:'shadow-v1',rank}},defer:p=>tasks.push(p)}),s.possibilities);await Promise.all(tasks);
 }
});
test('ranking projection includes approved data but excludes customer/business private fields',async()=>{
 const s=await search();const candidates=rankingCandidates(s.possibilities);assert.doesNotMatch(JSON.stringify(candidates),/adminSecret|token|secret/);assert.ok(candidates[0].rankingEvidence.products[0].description);
 const bad=structuredClone(candidates[0].rankingEvidence);bad.email='private@example.com';assert.equal(validateRankingEvidence(bad),null);
});
test('real offline artifact adapter runs only in shadow and requires declared feature compatibility',async()=>{
 const dataset=buildTrainingDataset(inputs(60)).dataset;const job=prepareTrainingCandidate({dataset,datasetVersion:dataset.datasetVersion,baseIntelligenceVersion:BASELINE_VERSION,purpose:'relevance-ranking'}).job;
 const artifact=trainOfflineRanker({job,candidateVersion:'offline-shadow-v1'}).artifact;const s=await search();assert.ok(offlineShadowProvider(artifact,s.possibilities,BASELINE_VERSION));
 const tasks=[];const cfg={...s.configuration,mode:'shadow',artifact,featurePolicyVersion:FEATURE_POLICY};assert.deepEqual(await completeCustomerSearch({...s,configuration:cfg,defer:p=>tasks.push(p)}),s.possibilities);await Promise.all(tasks);
 assert.deepEqual(await completeCustomerSearch({...s,configuration:{...cfg,mode:'candidate'}}),s.possibilities);
});
module.exports={work,confirmed};
test('negated published attributes are not positive matching facts',async()=>{
 const s=await search('waterproof jacket',[work('bad','Jacket is not waterproof')]);assert.deepEqual(s.possibilities,[]);
});
test('unknown availability cannot satisfy an explicit availability requirement',async()=>{
 const contact=work('contact');contact.products[0].availability='contact';const s=await search('available black jacket',[contact]);assert.deepEqual(s.possibilities,[]);
});
test('missing or failed lifecycle registration never starts shadow provider work',async()=>{
 let called=0;const s=await search('jacket',undefined,{...getCustomerSearchConfiguration(),mode:'shadow',allowProviderRequest:true,provider:{intelligenceVersion:'shadow-v1',rank:async()=>{called++;return {ranked:[]};}}});
 assert.deepEqual(await completeCustomerSearch(s),s.possibilities);
 assert.deepEqual(await completeCustomerSearch({...s,defer:()=>{throw Error('no lifecycle');}}),s.possibilities);await Promise.resolve();assert.equal(called,0);
});
