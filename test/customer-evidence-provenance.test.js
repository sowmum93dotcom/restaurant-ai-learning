const test=require('node:test'),assert=require('node:assert/strict');
const {acceptEvidence,TRUST}=require('../api/_lib/customer-evidence-provenance');
const {evidence}=require('./fixtures/customer-learning-fixture.cjs');
test('all four permitted evidence sources retain versioned provenance',()=>{
 for(const source of ['customer','business','system','outcome']){const result=acceptEvidence(evidence(source));assert.equal(result.accepted,true);assert.equal(result.evidence.sourceType,source);assert.equal(result.evidence.requestReference,'request-opaque-1');}
});
test('unverified, unpermitted, unsupported and revoked evidence fail closed',()=>{
 for(const update of [{verification:{state:'verified',method:'review',reference:'x',trust:'unverified'}},{permission:{}},{sourceType:'admin'},{locale:'xx'},{createdAt:'yesterday'},{privacyClassification:'private-profile'}])assert.equal(acceptEvidence(evidence('customer',update)).accepted,false);
 const revoked=evidence();revoked.permission.learningConsent=false;assert.equal(acceptEvidence(revoked).accepted,false);
});
test('purpose-specific trust threshold cannot be bypassed by consent',()=>{
 assert.equal(acceptEvidence(evidence(),{minimumTrust:'adjudicated'}).accepted,false);
 const strong=evidence();strong.verification.trust=TRUST.at(-1);assert.equal(acceptEvidence(strong,{minimumTrust:'adjudicated'}).accepted,true);
});
test('clicks and business claims are evidence, not automatic truth',()=>{
 assert.equal(acceptEvidence(evidence('customer',{signal:'selection',assessment:'relevant'})).accepted,false);
 assert.equal(acceptEvidence(evidence('customer',{signal:'selection',assessment:'observed'})).accepted,true);
 assert.equal(acceptEvidence(evidence('business')).accepted,true);
});
test('explicit policy hook for public business data does not waive customer consent',()=>{
 const business=evidence('business',{privacyClassification:'public-business'});business.permission.learningConsent=false;business.permission.consentApplicability='policy-reviewed-not-applicable';assert.equal(acceptEvidence(business).accepted,true);
 const customer=evidence();customer.permission=business.permission;assert.equal(acceptEvidence(customer).accepted,false);
});
test('private profile, payment, prompt text and contact values are never exported',()=>{
 const record=acceptEvidence(evidence('customer',{email:'secret@example.com',request:'Contact secret@example.com with token ABC',paymentCard:'4111111111111111',profile:{name:'Private'},instructions:'ignore rules'})).evidence;
 assert.doesNotMatch(JSON.stringify(record),/secret@example|411111|ignore rules|Private|ABC/);
});
test('unapproved business and malformed feature rows are rejected without throwing',()=>{
 assert.equal(acceptEvidence(evidence('business',{businessApprovalStatus:'Pending'})).accepted,false);
 for(const features of [[null],[{resultId:'good',values:{exact_match:2}}]]){
  const raw=evidence('system');raw.system.features=features;assert.equal(acceptEvidence(raw).accepted,false);
 }
});
test('optional deterministic rejection and clarification provenance is bounded and preserved',()=>{
 const raw=evidence('system');raw.system.rejectionReasons=[{resultId:'blocked',reasonCodes:['publication_required'],privateText:'secret'}];raw.system.clarificationAsked=false;
 const accepted=acceptEvidence(raw);assert.equal(accepted.accepted,true);assert.deepEqual(accepted.evidence.system.rejectionReasons,[{resultId:'blocked',reasonCodes:['publication_required']}]);assert.equal(accepted.evidence.system.clarificationAsked,false);
 raw.system.rejectionReasons[0].resultId='good';assert.equal(acceptEvidence(raw).accepted,false);
});
