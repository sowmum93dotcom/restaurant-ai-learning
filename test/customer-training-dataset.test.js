const test=require('node:test'),assert=require('node:assert/strict');
const {buildTrainingDataset,validateTrainingDataset,partition}=require('../api/_lib/customer-training-dataset');
const {inputs}=require('./fixtures/customer-learning-fixture.cjs');
const {fingerprint}=require('../api/_lib/customer-evidence-provenance');
test('dataset is reproducible, order-independent and traces evidence and label versions',()=>{
 const raw=inputs(60),a=buildTrainingDataset(raw),b=buildTrainingDataset({...raw,records:raw.records.slice().reverse()});assert.equal(a.ready,true);assert.equal(a.dataset.fingerprint,b.dataset.fingerprint);assert.equal(validateTrainingDataset(a.dataset),true);assert.equal(a.dataset.sourceEvidenceVersions.length,240);
});
test('related party evidence stays in one deterministic partition',()=>{
 const d=buildTrainingDataset(inputs(60)).dataset;const seen=new Set();
 for(const [part,rows]of Object.entries(d.partitions))for(const row of rows){assert.equal(partition(row.groupId),part);assert.equal(seen.has(row.groupId),false);seen.add(row.groupId);assert.equal(row.evidenceIds.length,4);}
 assert.ok(d.counts.validation>0 && d.counts.test>0);
});
test('raw evidence and pending adjudication cannot silently become a training dataset',()=>{
 const raw=inputs();assert.equal(buildTrainingDataset({...raw,decisions:{}}).ready,false);assert.equal(buildTrainingDataset({...raw,labelPolicyVersion:'different'}).ready,false);
});
test('tampering, partition leakage and PII fields fail validation even with recomputed fingerprint',()=>{
 const d=structuredClone(buildTrainingDataset(inputs(60)).dataset);d.partitions.test.push(d.partitions.train[0]);d.fingerprint=fingerprint(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='fingerprint')));assert.equal(validateTrainingDataset(d),false);
 const p=structuredClone(buildTrainingDataset(inputs(60)).dataset);p.partitions.train[0].email='secret@example.com';p.fingerprint=fingerprint(Object.fromEntries(Object.entries(p).filter(([k])=>k!=='fingerprint')));assert.equal(validateTrainingDataset(p),false);
});
