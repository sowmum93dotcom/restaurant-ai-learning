'use strict';
// Controlled engineering doubles. These cases make no real-model accuracy claim.
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareCustomerSearch,completeCustomerSearch}=require('../api/_lib/customer-search-service');
const {getCustomerSearchConfiguration}=require('../api/_lib/customer-search-registry');
const {SCHEMA_VERSION,BASELINE_VERSION,PURPOSE,suggestPublishedOfferCategories}=require('../api/_lib/customer-category-understanding');
const {fingerprint}=require('../api/_lib/customer-evidence-provenance');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
function catalogue(){return [{workItemId:'catering',businessId:'owner',businessName:'Verified fixture',content:'Published offer',participationAction:'Interested',location:'Manchester',customerContinuation:{routes:['website'],website:'https://example.org'},products:[{productId:'meal',businessId:'owner',name:'Catering Services',description:'Catering Services prepared banquet',price:'£89',availability:'available',continuationRoute:'website',categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:'89',sectorId:'5'}]}}]}];}
function configuration({span,fail=false}={}){
 return {...getCustomerSearchConfiguration(),categoryUnderstanding:{audience:'production',mode:'approved',version:'fixture-v1',allowProviderRequest:true,timeoutMs:250,
 provider:{intelligenceVersion:'fixture-v1',artifactFingerprint:'a'.repeat(64),classify:async input=>{if(fail)throw Error('fixture failure');return {schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,candidates:[{categoryId:'89',sectorId:'5',confidence:.9,evidence:span||{start:0,end:input.text.length}}]};}},
 resolveApproval:async(_version,{locale})=>({approved:true,purpose:PURPOSE,candidateVersion:'fixture-v1',artifactFingerprint:'a'.repeat(64),rollbackVersion:BASELINE_VERSION,decisionId:'fixture-approval',locale}),
 authorizeData:async r=>({allowed:true,purpose:PURPOSE,requestFingerprint:r.requestFingerprint,policyVersion:'fixture-policy'}),
 resolveRetrievalPhrase:async r=>[...Object.values(requests),'banquet','Catering Services'].includes(r.phrase)?{approved:true,purpose:r.purpose,decisionId:'reviewed-phrase',categoryId:r.categoryId,locale:r.locale,phrase:r.phrase,requestFingerprint:r.requestFingerprint,candidateFingerprint:r.candidateFingerprint,phraseFingerprint:fingerprint({categoryId:r.categoryId,locale:r.locale,phrase:r.phrase})}:null,
 resolveValidation:async r=>({approved:true,purpose:PURPOSE,decisionId:'fixture-validation',requestFingerprint:r.requestFingerprint,candidateFingerprint:r.candidateFingerprint,datasetVersion:DATASET_VERSION,locale:r.locale,scope:r.scope,constraintsPreserved:true,exclusionsPreserved:true})}};
}
async function search(text,{work=catalogue(),locale='en',config=configuration(),testMode=false}={}){
 const understanding=confirmCustomerUnderstanding(buildCustomerUnderstanding('',text));
 const prepared=await prepareCustomerSearch({understanding,work,locale,configuration:config,testMode});
 return completeCustomerSearch({prepared,possibilities:prepared.possibilities,understanding,work,configuration:config,testMode});
}
const requests={en:'A banquet provider',es:'Un proveedor de banquetes',fr:'Un prestataire de banquets',ar:'مزود ولائم',pt:'Um fornecedor de banquetes',zh:'宴会供应商',hi:'भोज प्रदाता',de:'Ein Bankettanbieter',ja:'宴会の提供者'};
for(const [locale,text] of Object.entries(requests))test('approved canonical same-offer retrieval reaches existing result pipeline: '+locale,async()=>{
 assert.deepEqual(await search(text,{locale,config:getCustomerSearchConfiguration()}),[]);
 const result=await search(text,{locale});assert.equal(result.length,1);assert.equal(result[0].products[0].productId,'meal');assert.equal(result[0].products[0].price,'£89');
 assert.doesNotMatch(JSON.stringify(result),/categoryClassification|datasetVersion|sectorId|candidateFingerprint|fixture-approval/);
});
test('semantic retrieval preserves hard requirements and cannot borrow another product evidence',async()=>{
 for(const text of ['A banquet provider under £50','A banquet provider near London','A banquet provider tomorrow','A banquet provider with sauna','A banquet provider for children','A banquet provider not prepared'])assert.deepEqual(await search(text),[],text);
 const text='banquet waterproof';assert.deepEqual(await search(text,{config:configuration({span:{start:0,end:7}})}),[]);
 const work=catalogue();work[0].products.push({...work[0].products[0],productId:'other',description:'Waterproof equipment',categoryClassification:undefined});
 assert.deepEqual(await search(text,{work,config:configuration({span:{start:0,end:7}})}),[]);
});
test('classification mismatch, ownership and availability cannot be repaired by semantic advice',async()=>{
 for(const mutate of [w=>delete w[0].products[0].categoryClassification,w=>w[0].products[0].businessId='another',w=>w[0].products[0].availability='unavailable',w=>w[0].operationalAvailability={status:'unavailable'},w=>{w[0].products[0].name='Offer';w[0].products[0].description='Not Catering Services';}]){
  const work=catalogue();mutate(work);assert.deepEqual(await search('A banquet provider',{work}),[],mutate.toString());
 }
 const work=catalogue(),before=structuredClone(work);await search('A banquet provider',{work});assert.deepEqual(work,before);
});
test('ambiguity and provider failures retain deterministic fallback',async()=>{
 const c=configuration();c.categoryUnderstanding.provider.classify=async()=>({schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,candidates:[]});
 assert.deepEqual(await search('Something perhaps',{config:c}),[]);
 assert.deepEqual(await search('A banquet provider',{config:configuration({fail:true})}),[]);
 assert.deepEqual(await search('Catering Services',{config:configuration({fail:true})}),await search('Catering Services',{config:getCustomerSearchConfiguration()}));
 const deny=configuration();deny.categoryUnderstanding.resolveValidation=async()=>null;assert.deepEqual(await search('A banquet provider',{config:deny}),[]);
});
test('nine-language negation conservatively stays baseline without invoking a provider',async()=>{
 const negatives={en:'not a banquet provider',es:'sin banquetes',fr:'sans banquets',ar:'بدون ولائم',pt:'sem banquetes',zh:'不要宴会',hi:'भोज नहीं',de:'kein Bankett',ja:'宴会は不要'};
 let called=0;const c=configuration();c.categoryUnderstanding.provider.classify=()=>{called++;throw Error('must not call');};
 for(const [locale,text] of Object.entries(negatives))assert.deepEqual(await search(text,{locale,config:c}),await search(text,{locale,config:getCustomerSearchConfiguration()}));
 assert.equal(called,0);
});
test('controlled requests and private text cannot reach understanding providers',async()=>{
 let called=0;const c=configuration();c.categoryUnderstanding.provider.classify=()=>{called++;throw Error('must not call');};
 await search('A banquet provider',{config:c,testMode:true});await search('Email private@example.org for a banquet',{config:c});assert.equal(called,0);
});
test('same-offer suggestions remain candidates only and never write classifications',async()=>{
 const work=catalogue();delete work[0].products[0].categoryClassification;const before=structuredClone(work);
 const result=await suggestPublishedOfferCategories({work,workItemId:'catering',productId:'meal',configuration:configuration()});assert.deepEqual(result.interpretation.categoryIds,['89']);assert.deepEqual(work,before);
 const wrong=await suggestPublishedOfferCategories({work,workItemId:'catering',productId:'another',configuration:configuration()});assert.equal(wrong.reason,'published_offer_missing');
});

test('controlled completion cannot export catalogue candidates to ranking providers',async()=>{
 let calls=0;const c=configuration();c.mode='candidate';c.allowProviderRequest=true;c.provider={intelligenceVersion:'rank-fixture',artifactFingerprint:'a'.repeat(64),rank:async()=>{calls++;throw Error('controlled ranking egress');}};
 c.resolveApproval=async()=>({approved:true,purpose:'relevance-ranking',candidateVersion:'rank-fixture',artifactFingerprint:'a'.repeat(64),rollbackVersion:c.baselineVersion,decisionId:'rank-fixture'});
 const result=await search('Catering Services',{config:c,testMode:true});assert.equal(result.length,1);assert.equal(calls,0);
});

test('qualifiers inside an oversized semantic span cannot gain retrieval authority',async()=>{
 for(const text of ['vegan banquet','gluten-free banquet','wheelchair accessible banquet'])assert.deepEqual(await search(text),[]);
 const c=configuration();delete c.categoryUnderstanding.resolveRetrievalPhrase;assert.deepEqual(await search('A banquet provider',{config:c}),[]);
});
test('lexical sibling products cannot bypass same-offer category and residual evidence',async()=>{
 const work=catalogue();work[0].products.push({...work[0].products[0],productId:'jacket',name:'Jacket',description:'Black jacket',categoryClassification:undefined});
 assert.deepEqual(await search('banquet jacket',{work,config:configuration({span:{start:0,end:7}})}),[]);
});
test('long published names keep matching evidence within the existing browser contract',async()=>{
 const work=catalogue();work[0].products[0].name='Catering Services '+ 'banquet '.repeat(20);
 const result=await search('A banquet provider',{work});assert.equal(result.length,1);
 const {toCustomerPossibility}=require('../js/customer');assert.ok(toCustomerPossibility(result[0]));
 assert.ok(result[0].relevance.evidence.every(value=>value.length<=60));assert.ok(result[0].products[0].relevance.evidence.every(value=>value.length<=60));
});
test('retrieval phrase permission is bound to the exact source, locale, category and reviewed phrase',async()=>{
 for(const field of ['phrase','categoryId','locale','requestFingerprint','candidateFingerprint','phraseFingerprint','decisionId']){
  const c=configuration(),resolve=c.categoryUnderstanding.resolveRetrievalPhrase;
  c.categoryUnderstanding.resolveRetrievalPhrase=async r=>({...await resolve(r),[field]:field==='decisionId'?'':'wrong'});
  assert.deepEqual(await search('A banquet provider',{config:c}),[],field);
 }
});

test('parsed location is enforced against business place independently of product wording',async()=>{
 const prefix='A banquet provider',config=configuration({span:{start:0,end:prefix.length}});
 const result=await search(prefix+' near Manchester',{config});assert.equal(result.length,1);assert.equal(result[0].location,'Manchester');
 assert.deepEqual(await search(prefix+' near London',{config}),[]);
 assert.equal((await search(prefix+' under £100 near Manchester',{config})).length,1);
 assert.deepEqual(await search(prefix+' under £50 near Manchester',{config}),[]);
});
