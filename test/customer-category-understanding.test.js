'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {SCHEMA_VERSION,BASELINE_VERSION,PURPOSE,validateSemanticCandidates,understandCustomerCategories,suggestPublishedOfferCategories}=require('../api/_lib/customer-category-understanding');
const {getCustomerSearchConfiguration}=require('../api/_lib/customer-search-registry');
const {prepareCustomerSearch,completeCustomerSearch}=require('../api/_lib/customer-search-service');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {interpretCategories}=require('../api/_lib/customer-category-classification');
function response(text,categoryId='89',sectorId='5'){
 return {schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,candidates:[{categoryId,sectorId,confidence:.9,evidence:{start:0,end:text.length}}]};
}
// Explicit controlled test doubles. No real intelligence/approval/policy exists.
function configured(classify=input=>response(input.text)){
 const c={mode:'approved',version:'controlled-category-v1',allowProviderRequest:true,provider:{intelligenceVersion:'controlled-category-v1',artifactFingerprint:'a'.repeat(64),classify},
 resolveApproval:async(_version,{locale})=>({approved:true,purpose:PURPOSE,candidateVersion:'controlled-category-v1',artifactFingerprint:'a'.repeat(64),rollbackVersion:BASELINE_VERSION,decisionId:'controlled-approval',locale}),
 authorizeData:async request=>({allowed:true,purpose:PURPOSE,requestFingerprint:request.requestFingerprint,policyVersion:'controlled-policy'}),
 resolveValidation:async request=>({approved:true,purpose:PURPOSE,decisionId:'controlled-validation',requestFingerprint:request.requestFingerprint,candidateFingerprint:request.candidateFingerprint,datasetVersion:DATASET_VERSION,locale:request.locale,scope:request.scope,constraintsPreserved:true,exclusionsPreserved:true})};
 return {...getCustomerSearchConfiguration(),categoryUnderstanding:c};
}
test('default keeps literal baseline and never calls an unapproved semantic provider',async()=>{
 assert.equal(getCustomerSearchConfiguration().categoryUnderstanding,null);
 const text='I need someone to provide food for my wedding';
 assert.deepEqual((await understandCustomerCategories({text})).interpretation,interpretCategories(text));
 let called=0;const configuration=configured(()=>{called++;});configuration.categoryUnderstanding.mode='candidate';
 assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,[]);assert.equal(called,0);
});
test('natural paraphrases and multiple categories require independent source-bound validation',async()=>{
 for(const [text,id] of [['I need someone to provide food for my wedding','89'],['I need someone to clean my office every evening','93']]){
  const configuration=configured(input=>response(input.text,id));
  const result=await understandCustomerCategories({text,configuration});assert.deepEqual(result.interpretation.categoryIds,[id]);assert.equal(result.reason,'validated_category_understanding');
  configuration.categoryUnderstanding.resolveValidation=async()=>null;
  assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,[]);
 }
 const text='Provide wedding food and clean the venue afterwards';
 const configuration=configured(input=>({...response(input.text),candidates:[...response(input.text).candidates,...response(input.text,'93').candidates]}));
 assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,['89','93']);
});

test('semantic suggestions cannot replace or discard explicit canonical category intent',async()=>{
 for(const text of ['Fashion and Apparel Commerce','Catering Services and Cleaning Services']){
  const configuration=configured(input=>response(input.text));
  const result=await understandCustomerCategories({text,configuration});
  assert.deepEqual(result.interpretation,interpretCategories(text));assert.equal(result.reason,'explicit_category_preserved');
 }
});
test('strict semantic response rejects unknown IDs, wrong sectors, names, facts, bounds, duplicates and accessors',()=>{
 const text='food for a wedding',good=response(text);assert.ok(validateSemanticCandidates(good,text));
 const row=good.candidates[0];
 for(const bad of [null,{...good,schemaVersion:'wrong'},{...good,datasetVersion:'wrong'},{...good,price:12},{...good,candidates:[{...row,categoryId:'172'}]},{...good,candidates:[{...row,sectorId:'1'}]},{...good,candidates:[{...row,categoryName:'Invented'}]},{...good,candidates:[row,row]},{...good,candidates:Array(9).fill(row)},{...good,candidates:[{...row,confidence:NaN}]},{...good,candidates:[{...row,confidence:1.1}]},{...good,candidates:[{...row,evidence:{start:-1,end:10}}]},{...good,candidates:[{...row,evidence:{start:0,end:100}}]},{...good,candidates:[{...row,evidence:{start:0,end:0}}]},{...good,candidates:[{...row,evidence:{start:0,end:10,text:'invented'}}]}])assert.equal(validateSemanticCandidates(bad,text),null);
 const getter={...good};Object.defineProperty(getter,'candidates',{enumerable:true,get(){throw new Error('untrusted');}});assert.equal(validateSemanticCandidates(getter,text),null);
 assert.equal(validateSemanticCandidates(response('   '),'   '),null);
});

test('evaluation harness exercises actual category boundary and malformed semantic fallback',async()=>{
 const {CASES}=require('../api/_lib/customer-category-eval-set');
 const {evaluateCategoryUnderstanding}=require('../api/_lib/customer-category-evaluation');
 const cases=CASES.filter(row=>['canonical','wedding-paraphrase','short-negation','long-negation','exclusion','except','malformed','invented','wrong-sector'].includes(row.caseId));
 const result=await evaluateCategoryUnderstanding({cases,evaluate:row=>understandCustomerCategories({text:row.text,locale:row.locale,configuration:configured(input=>row.responseScenario==='malformed-response'?{invalid:true}:row.responseScenario==='unknown-category'?response(input.text,'172'):row.responseScenario==='incorrect-sector'?response(input.text,'89','1'):response(input.text))})});
 assert.equal(result.counts['correct-classification'],cases.length);assert.equal(result.counts['unsafe-classification'],0);assert.equal(result.releaseGatePassed,false);
});
test('semantic output cannot reverse short or long exclusions, even using a positive evidence substring',async()=>{
 const texts=['I do not want catering','Exclude cleaning services','Anything except catering','I do not want to use any Catering Services','We do not currently intend to offer Catering Services','I need wedding food; not catering','Not, only catering',"I don't want catering"];
 let called=0;const configuration=configured(input=>{called++;return response(input.text);});
 for(const text of texts){assert.equal(validateSemanticCandidates(response(text),text),null);assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation,interpretCategories(text));}
 assert.equal(called,0);
 const text='Not only Fashion and Apparel Commerce';assert.deepEqual((await understandCustomerCategories({text,configuration:configured(input=>response(input.text,'10','1'))})).interpretation.categoryIds,['10']);
 assert.deepEqual((await understandCustomerCategories({text:'Not Cleaning Services; Catering Services',configuration})).interpretation.categoryIds,['89']);
});
test('approval is bound to exact version, fingerprint, purpose, locale and literal rollback baseline',async()=>{
 const text='wedding food';
 for(const field of ['candidateVersion','artifactFingerprint','purpose','locale','rollbackVersion','decisionId']){
  let called=0;const configuration=configured(()=>{called++;});const original=configuration.categoryUnderstanding.resolveApproval;
  configuration.categoryUnderstanding.resolveApproval=async(...args)=>({...await original(...args),[field]:'wrong'});
  if(field==='decisionId')configuration.categoryUnderstanding.resolveApproval=async(...args)=>({...await original(...args),decisionId:''});
  assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,[],field);assert.equal(called,0);
 }
 const configuration=configured();configuration.categoryUnderstanding.provider.intelligenceVersion='other';assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,[]);
});
test('privacy policy and validation cannot approve another source, candidate set or weakened exclusions',async()=>{
 const text='wedding food';
 for(const patch of [{approved:false},{requestFingerprint:'other'},{candidateFingerprint:'other'},{datasetVersion:'other'},{locale:'fr'},{scope:'published-offer'},{constraintsPreserved:false},{exclusionsPreserved:false},{decisionId:''},{selfApproved:true}]){
  const configuration=configured();const original=configuration.categoryUnderstanding.resolveValidation;
  configuration.categoryUnderstanding.resolveValidation=async request=>({...await original(request),...patch});
  assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation.categoryIds,[],JSON.stringify(patch));
 }
 let called=0;const configuration=configured(()=>{called++;});configuration.categoryUnderstanding.authorizeData=async()=>({allowed:true,purpose:PURPOSE,requestFingerprint:'wrong',policyVersion:'policy'});
 await understandCustomerCategories({text,configuration});assert.equal(called,0);
});
test('provider failure, malformed response and a total deadline preserve baseline',async()=>{
 const text='Catering Services';
 for(const classify of [()=>{throw new Error('failure');},()=>({nonsense:true}),()=>new Promise(()=>{})]){
  const configuration=configured(classify);configuration.categoryUnderstanding.timeoutMs=5;
  assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation,interpretCategories(text));
 }
 let providerCalled=0;const configuration=configured(()=>{providerCalled++;});configuration.categoryUnderstanding.timeoutMs=5;configuration.categoryUnderstanding.resolveApproval=()=>new Promise(()=>{});
 assert.deepEqual((await understandCustomerCategories({text,configuration})).interpretation,interpretCategories(text));assert.equal(providerCalled,0);
});
test('deadline abort prevents a late approval or provider response starting later stages',async()=>{
 let called=0;const configuration=configured(()=>{called++;});configuration.categoryUnderstanding.timeoutMs=5;
 configuration.categoryUnderstanding.resolveApproval=()=>new Promise(resolve=>setTimeout(()=>resolve({}),15));
 await understandCustomerCategories({text:'wedding food',configuration});await new Promise(resolve=>setTimeout(resolve,25));assert.equal(called,0);
 let validated=0;const c=configured(input=>new Promise(resolve=>setTimeout(()=>resolve(response(input.text)),15)));c.categoryUnderstanding.timeoutMs=5;c.categoryUnderstanding.resolveValidation=async()=>{validated++;};
 await understandCustomerCategories({text:'wedding food',configuration:c});await new Promise(resolve=>setTimeout(resolve,25));assert.equal(validated,0);
});
test('provider receives only bounded data text and canonical registry, never request identity or private fields',async()=>{
 let payload;const configuration=configured(input=>{payload=input;return response(input.text);});
 await understandCustomerCategories({text:'wedding food',locale:'fr',configuration,customerEmail:'private@example.com',paymentToken:'secret'});
 assert.deepEqual(Object.keys(payload).sort(),['categories','dataOnly','datasetVersion','locale','schemaVersion','scope','signal','text']);assert.equal(payload.categories.length,171);assert.ok(Object.isFrozen(payload.categories[0]));assert.equal(payload.locale,'fr');assert.doesNotMatch(JSON.stringify(payload),/private@example|paymentToken/);
 for(const text of ['food contact private@example.com','food token=secret','food Bearer secret123','food 07123456789']){
  payload=null;await understandCustomerCategories({text,configuration});assert.equal(payload,null);
 }
 let calls=0;configuration.categoryUnderstanding.provider.classify=()=>{calls++;};
 await understandCustomerCategories({text:'x'.repeat(501),configuration});await understandCustomerCategories({text:'food',locale:'unknown',configuration});assert.equal(calls,0);
});
function offer(){return {workItemId:'offer',businessId:'owner',businessName:'Public name',content:'Unrelated slogan',location:'Manchester',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},privateEmail:'private@example.com',products:[{productId:'product',businessId:'owner',name:'Event food',description:'Prepare food for wedding guests',price:'£89',availability:'available',continuationRoute:'website',password:'secret'}]};}
test('business suggestions use only same ownership-validated public offer and never mutate catalogue or persist approval',async()=>{
 const item=offer(),before=structuredClone(item);let payload,source;
 const configuration=configured(input=>{payload=input;return response(input.text);});const original=configuration.categoryUnderstanding.authorizeData;
 configuration.categoryUnderstanding.authorizeData=async request=>{source=request.sourceReference;return original(request);};
 const result=await suggestPublishedOfferCategories({work:[item],workItemId:'offer',productId:'product',configuration});
 assert.deepEqual(result.interpretation.categoryIds,['89']);assert.equal(payload.text,'Event food Prepare food for wedding guests');assert.deepEqual(source,{workItemId:'offer',productId:'product'});assert.doesNotMatch(JSON.stringify(payload),/private@example|secret|Unrelated slogan|£89|Manchester|workItemId|productId/);assert.deepEqual(item,before);
 payload=null;item.products[0].businessId='another-owner';await suggestPublishedOfferCategories({work:[item],workItemId:'offer',productId:'product',configuration});assert.equal(payload,null);
 payload=null;await suggestPublishedOfferCategories({work:[before],workItemId:'offer',productId:'product',configuration,testMode:true});assert.equal(payload,null);
});
test('semantic category narrowing preserves deterministic budget, location, date and exclusion controls and guarded ranking',async()=>{
 const work=offer();work.products[0].name='Black jacket';work.products[0].description='Fashion and Apparel Commerce black jacket';work.products[0].categoryClassification={datasetVersion:DATASET_VERSION,categories:[{categoryId:'10',sectorId:'1'}]};
 const configuration=configured(input=>response(input.text,'10','1'));
 for(const text of ['black jacket under £50','black jacket near London','black jacket tomorrow','jacket not black']){
  const understanding=confirmCustomerUnderstanding(buildCustomerUnderstanding('',text));
  const prepared=await prepareCustomerSearch({understanding,work:[work],configuration});assert.deepEqual(prepared.possibilities,[],text);
 }
 const understanding=confirmCustomerUnderstanding(buildCustomerUnderstanding('','black jacket under £100'));
 const prepared=await prepareCustomerSearch({understanding,work:[work],configuration});assert.equal(prepared.possibilities.length,1);
 const visible=await completeCustomerSearch({prepared,possibilities:prepared.possibilities,understanding,work:[work],configuration:{...configuration,mode:'candidate'}});assert.deepEqual(visible,prepared.possibilities);assert.doesNotMatch(JSON.stringify(visible),/candidateFingerprint|schemaVersion|categoryUnderstanding|validated-semantic/);
});
