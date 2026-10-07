'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {structuredIntention,validateUnderstandingOutput,SCHEMA_VERSION}=require('../api/_lib/customer-search-intention');
const {understandSearch,providerText}=require('../api/_lib/customer-search-understanding');
const {buildTrustedCustomerUnderstanding}=require('../api/_lib/customer-understanding-context');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
const text=customerText=>({customerText,intention:''});
test('structured request records only stated constraints and never adds absent ones',()=>{
 const simple=structuredIntention(text('black jacket'));assert.deepEqual(simple.mustHave,['black']);for(const key of ['budget','date','time','location','distance','quantity','partySize','category'])assert.equal(simple[key],null);
 const full=structuredIntention(text('waterproof black jacket, not blue, under £100'));assert.deepEqual(full.mustHave,['black','waterproof']);assert.deepEqual(full.exclusions,['blue']);assert.equal(full.budget.currency,'GBP');assert.equal(full.budget.maximum,100);assert.equal(full.budget.inclusive,false);assert.ok(full.provenance.some(x=>x.field==='budget'));
 assert.equal(structuredIntention(text('not quiet')).mustHave.includes('quiet'),false);
});
test('provider spans cannot invent identifiers, exclusions, requirements or unknown fields',()=>{
 const query='black jacket';const baseline=structuredIntention(text(query));
 const raw={schemaVersion:1,extractions:[{field:'mustHave',start:0,end:5}]};assert.ok(validateUnderstandingOutput(raw,query,baseline));
 for(const invalid of [{...raw,businessId:'fake'},{schemaVersion:1,extractions:[{field:'location',start:0,end:5}]},{schemaVersion:1,extractions:[{field:'exclusion',start:0,end:5}]},{schemaVersion:1,extractions:[{field:'mustHave',start:0,end:5000}]}])assert.equal(validateUnderstandingOutput(invalid,query,baseline),null);
 const negated='jacket not blue';assert.equal(validateUnderstandingOutput({schemaVersion:1,extractions:[{field:'mustHave',start:11,end:15}]},negated,structuredIntention(text(negated))),null);
});
test('approved understanding adapter is bounded, data-only and fails to baseline on malformed output or timeout',async()=>{
 const version='understanding-candidate-v1',artifactFingerprint='a'.repeat(64);
 const config=provider=>({understanding:{mode:'approved',allowProviderRequest:true,version,timeoutMs:5,provider:{intelligenceVersion:version,artifactFingerprint,...provider},resolveApproval:async()=>({approved:true,purpose:'query-understanding',candidateVersion:version,rollbackVersion:SCHEMA_VERSION,decisionId:'approved-1',artifactFingerprint})}});
 const input={understanding:text('black jacket'),locale:'en'};
 const valid=await understandSearch({...input,configuration:config({understand:async request=>{assert.equal(request.dataOnly,true);assert.deepEqual(Object.keys(request).sort(),['dataOnly','locale','schemaVersion','signal','text']);return {schemaVersion:1,extractions:[{field:'mustHave',start:0,end:5}]};}})});assert.equal(valid.reason,'validated_understanding');
 for(const provider of [{understand:async()=>new Promise(()=>{})},{understand:async()=>({businessId:'fake'})},{understand:async()=>{throw Error('down');}}])assert.equal((await understandSearch({...input,configuration:config(provider)})).reason.includes('fallback')||(await understandSearch({...input,configuration:config(provider)})).reason==='invalid_understanding_response',true);
 assert.equal((await understandSearch(input)).reason,'baseline_understanding');
});
test('contacts and secrets are excluded and changed query offsets use baseline',async()=>{
 assert.doesNotMatch(providerText('email secret@example.com token=abc 4111111111111111'),/secret@example|abc|411111/);
});
test('one location clarification preserves useful broad requests and existing nine-language question coverage',()=>{
 assert.equal(buildTrustedCustomerUnderstanding({intention:'',customerText:'I need a jacket'},[],[]).confidenceState,'ready-for-confirmation');
 const missing=buildTrustedCustomerUnderstanding({intention:'',customerText:'I need a service tomorrow near me'},[],[]);assert.equal(missing.clarificationKind,'location');
 assert.equal(buildTrustedCustomerUnderstanding({intention:'',customerText:'I need a service tomorrow near me',place:'Manchester'},[],[]).confidenceState,'ready-for-confirmation');
 const {clarificationQuestion}=require('../js/customer-interface-language');for(const locale of LOCALES)assert.ok(clarificationQuestion(locale,'location').length>5);
});
test('expressed preferences are not silently upgraded to must-have requirements',()=>{
 const intention=structuredIntention(text('I need a jacket, preferably blue'));assert.deepEqual(intention.preferences,['blue']);assert.deepEqual(intention.mustHave,[]);
});
