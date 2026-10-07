const test=require('node:test'),assert=require('node:assert/strict');
const {groupEvidence,constructLearningLabel}=require('../api/_lib/customer-learning-labels');
const {evidence,decision}=require('./fixtures/customer-learning-fixture.cjs');
const group=records=>groupEvidence(records).groups[0];
test('conflicts preserve both parties, and only reviewed evidence can construct a label',()=>{
 const g=group([evidence('customer',{assessment:'irrelevant'}),evidence('business'),evidence('system')]);assert.equal(g.conflicts.length,1);
 assert.equal(constructLearningLabel(g,decision(g,{resolvedEvidenceIds:[]})).accepted,false);
 assert.equal(constructLearningLabel(g,decision(g,{expectedResultIds:[]})).accepted,true);
});
test('business claims and customer clicks alone never produce training labels',()=>{
 for(const raw of [evidence('business'),evidence('customer',{signal:'selection',assessment:'observed'})]){const g=group([raw,evidence('system')]);assert.equal(constructLearningLabel(g,decision(g)).accepted,false);}
});
test('verified later correction outweighs no evidence automatically; adjudication is still mandatory',()=>{
 const g=group([evidence('customer',{signal:'selection',assessment:'observed'}),evidence('outcome',{assessment:'irrelevant',signal:'verified_mismatch'}),evidence('system')]);
 assert.equal(constructLearningLabel(g,{}).accepted,false);assert.equal(constructLearningLabel(g,decision(g,{expectedResultIds:[]})).accepted,true);
});
test('label cannot introduce an ineligible result or bypass integrity',()=>{
 const g=group([evidence(),evidence('system')]);assert.equal(constructLearningLabel(g,decision(g,{expectedResultIds:['blocked']})).accepted,false);
 const bad=evidence('system');bad.system.factIntegrityPassed=false;const b=group([evidence(),bad]);assert.equal(constructLearningLabel(b,decision(b)).accepted,false);
});
test('mismatching snapshots and duplicate evidence are rejected',()=>{
 assert.equal(groupEvidence([evidence(),evidence()]).valid,false);
 const g=group([evidence(),evidence('system',{catalogueVersion:'other'})]);assert.equal(constructLearningLabel(g,decision(g)).accepted,false);
 assert.equal(groupEvidence([evidence(),evidence('system',{evaluationId:'different-group'})]).valid,false);
});
test('business self-claim conflicting with deterministic rejection is detected',()=>{
 const g=group([evidence('business',{resultIds:['blocked']}),evidence(),evidence('system')]);assert.ok(g.conflicts.some(c=>c.resultIds.includes('blocked')));
});
