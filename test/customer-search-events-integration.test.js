'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {searchReference,emitSearchEvidence,emitCustomerAction}=require('../api/_lib/customer-search-events');
const {constructLearningLabel,groupEvidence}=require('../api/_lib/customer-learning-labels');
const {getCustomerSearchConfiguration}=require('../api/_lib/customer-search-registry');
const {acceptEvidence}=require('../api/_lib/customer-evidence-provenance');
function policy(learningConsent=true){
 const written=[];return {written,configuration:{...getCustomerSearchConfiguration(),evidence:{authorize:async()=>({permission:{decision:'approved',policyVersion:'reviewed-policy-v1',allowedPurposes:['relevance-ranking'],learningConsent},privacyClassification:'deidentified',retentionClassification:'training-window',businessSources:{w1:{approvalStatus:'Approved',verificationReference:'published-source-1'}}}),write:async records=>written.push(...records)}}};
}
const possibilities=[{possibilityId:'p1',workItemId:'w1',content:'Approved public jacket',relevance:{evidence:['jacket']}}],work=[{workItemId:'w1'}];
test('default search events export nothing and guidance consent is insufficient',async()=>{
 const reference=searchReference(work);assert.equal((await emitSearchEvidence({configuration:getCustomerSearchConfiguration(),reference,possibilities,work})).captured,false);
 const p=policy(false);assert.equal((await emitSearchEvidence({...p,reference,possibilities,work,identity:{email:'secret@example.com'}})).captured,false);assert.deepEqual(p.written,[]);
});
test('permitted system and business evidence preserves provenance, ordering and constraints without private values',async()=>{
 const p=policy(),reference=searchReference(work);const result=await emitSearchEvidence({...p,reference,possibilities,work,identity:{trustedCustomerIdentityId:'secret-identity',email:'secret@example.com'},mode:'shadow',shadowOrdering:['p1'],rejected:[{resultId:'p2',reason:'hard_requirement_not_supported'}]});
 assert.equal(result.captured,true);assert.deepEqual(p.written.map(r=>r.sourceType),['system','business']);assert.deepEqual(p.written[0].system.execution.shadowOrdering,['p1']);assert.deepEqual(p.written[0].system.rejectedIds,['p2']);assert.equal(p.written[0].catalogueVersion,reference.catalogueVersion);assert.doesNotMatch(JSON.stringify(p.written),/secret-identity|secret@example/);
 const group=groupEvidence(p.written).groups[0];assert.equal(constructLearningLabel(group,{approved:true,trust:'adjudicated',decisionId:'judge',policyVersion:'labels-v1',reasonCode:'reviewed',resolvedEvidenceIds:group.evidence.map(r=>r.evidenceId),expectedResultIds:['p1']}).accepted,false);
});
test('controlled examples cannot enter genuine production evidence even with a configured policy',async()=>{
 const p=policy();assert.equal((await emitSearchEvidence({...p,reference:searchReference(work),possibilities,work,testMode:true})).captured,false);assert.deepEqual(p.written,[]);
});
test('linked recorded clicks and saves remain observations; missing provenance or consent prevents export',async()=>{
 const p=policy(),reference=searchReference(work);p.configuration.evidence.resolveInteraction=async()=>({reference,possibilityId:'p1',testMode:false});
 assert.equal((await emitCustomerAction({...p,customerId:'private-id',workItemId:'w1',signal:'selection'})).captured,true);assert.equal(p.written[0].assessment,'observed');assert.equal(p.written[0].status,undefined);assert.doesNotMatch(JSON.stringify(p.written),/private-id/);
 p.configuration.evidence.resolveInteraction=async()=>({possibilityId:'p1',testMode:false});assert.equal((await emitCustomerAction({...p,customerId:'private-id',workItemId:'w1',signal:'save'})).captured,false);
});
test('execution evidence rejects visible shadow changes and unknown result IDs',()=>{
 const raw={...require('./fixtures/customer-learning-fixture.cjs').evidence('system')};raw.system.execution={mode:'shadow',baselineOrdering:['bad','good'],visibleOrdering:['good','bad'],shadowOrdering:['good','bad']};assert.equal(acceptEvidence(raw).accepted,false);
 raw.system.execution.visibleOrdering=['bad','good'];raw.system.execution.shadowOrdering=['unknown'];assert.equal(acceptEvidence(raw).accepted,false);
});
