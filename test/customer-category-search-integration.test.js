'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {validateClassification,classificationFromProducts,interpretCategories,validateCategoryAdvisory,selectCategoryWork}=require('../api/_lib/customer-category-classification');
const {getValidPublicCustomerWork}=require('../api/_lib/customer-public-work-contract');
const {prepareCustomerSearch,completeCustomerSearch}=require('../api/_lib/customer-search-service');
const {getCustomerSearchConfiguration,BASELINE_VERSION}=require('../api/_lib/customer-search-registry');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {emitSearchEvidence}=require('../api/_lib/customer-search-events');
const classification=(id='10',sectorId='1')=>({datasetVersion:DATASET_VERSION,categories:[{categoryId:id,sectorId}]});
function work(id='a',price='£89',category='10') {
 const name=category==='10'?'Fashion and Apparel Commerce':'Electronics and Devices';
 return {workItemId:id,businessId:'business-'+id,businessName:'Controlled fixture',content:'Fashion and Apparel Commerce black waterproof jacket',location:'Manchester',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},privateEmail:'private@example.com',products:[{productId:'p-'+id,businessId:'business-'+id,name:'Black waterproof jacket',description:name+' black waterproof jacket',price,availability:'available',continuationRoute:'website',categoryClassification:classification(category),adminToken:'private-token'}]};
}
async function prepared(text='Fashion and Apparel Commerce black jacket',items=[work()]) {
 const understanding=confirmCustomerUnderstanding(buildCustomerUnderstanding('',text));const configuration=getCustomerSearchConfiguration();
 return {understanding,configuration,work:items,prepared:await prepareCustomerSearch({understanding,configuration,work:items})};
}
test('references require correct dataset, sector and same-offer published evidence; business claims are not authority',()=>{
 assert.ok(validateClassification(classification(),'Fashion and Apparel Commerce black jacket'));
 assert.equal(validateClassification(classification(),'Black jacket'),null);
 assert.equal(validateClassification({...classification(),approved:true},'Fashion and Apparel Commerce'),null);
 assert.equal(validateClassification(classification('172'),'Fashion and Apparel Commerce'),null);
 assert.equal(validateClassification(classification('10','2'),'Fashion and Apparel Commerce'),null);
 assert.equal(validateClassification({...classification(),datasetVersion:'wrong'},'Fashion and Apparel Commerce'),null);
 assert.equal(validateClassification({datasetVersion:DATASET_VERSION,categories:[...classification().categories,...classification().categories]},'Fashion and Apparel Commerce'),null);
 const item=work();item.categoryClassification=classification('11');const projected=getValidPublicCustomerWork([item],20,{forSearchClassification:true})[0];assert.deepEqual(projected.categoryClassification.categories,[{categoryId:'10',sectorId:'1'}]);
});
test('internal shared projection preserves references but public payload and ranking exclude classification and private fields',async()=>{
 const item=work(),internal=getValidPublicCustomerWork([item],20,{forSearchClassification:true})[0];assert.equal(internal.products[0].categoryClassification.datasetVersion,DATASET_VERSION);
 const publicWork=getValidPublicCustomerWork([item]);assert.doesNotMatch(JSON.stringify(publicWork),/categoryClassification|datasetVersion|sectorId|private@example|private-token/);
 const state=await prepared();const response=await completeCustomerSearch({...state,possibilities:state.prepared.possibilities});assert.equal(response.length,1);assert.doesNotMatch(JSON.stringify(response),/categoryClassification|datasetVersion|sectorId|private@example|private-token/);
 assert.doesNotMatch(JSON.stringify(require('../api/_lib/customer-search-ranking').rankingCandidates(response)),/categoryClassification|datasetVersion|sectorId|private@example|private-token/);
});
test('literal interpretation preserves multiple categories, negation and unresolved baseline fallback',()=>{
 assert.deepEqual(interpretCategories('Fashion and Apparel Commerce and Electronics and Devices').categoryIds,['10','11']);
 assert.deepEqual(interpretCategories('not Cleaning Services; Catering Services').categoryIds,['89']);
 for (const text of ['black jacket','unknown category','I need something'])assert.deepEqual(interpretCategories(text).categoryIds,[]);
 assert.deepEqual(interpretCategories('Fashion and Apparel Commerce'.repeat(30)).categoryIds,[]);
});
test('advisory output cannot invent or rename categories or turn absent evidence into category authority',()=>{
 const text='I need Catering Services',start=text.indexOf('Catering');const valid={datasetVersion:DATASET_VERSION,categories:[{categoryId:'89',start,end:text.length}]};assert.deepEqual(validateCategoryAdvisory(valid,text).categoryIds,['89']);
 for(const bad of [{...valid,categoryName:'New category'},{...valid,datasetVersion:'wrong'},{...valid,categories:[{categoryId:'999',start,end:text.length}]},{...valid,categories:[{categoryId:'93',start,end:text.length}]},{...valid,categories:[valid.categories[0],valid.categories[0]]}])assert.equal(validateCategoryAdvisory(bad,text),null);
});
test('category narrowing cannot create an offer and preserves unclassified fallback and input records',async()=>{
 const relevant=work('relevant'),opposite=work('opposite','£89','11'),unclassified=work('unclassified');delete unclassified.products[0].categoryClassification;
 const items=[opposite,relevant,unclassified],before=structuredClone(items);const selected=selectCategoryWork(items,interpretCategories('Fashion and Apparel Commerce'));
 assert.deepEqual(selected.work.map(w=>w.workItemId),['relevant','unclassified']);assert.deepEqual(items,before);
 const state=await prepared(undefined,items);assert.deepEqual(state.prepared.possibilities.map(p=>p.workItemId).sort(),['relevant','unclassified']);assert.ok(state.prepared.rejected.some(r=>r.reason==='category_classification_mismatch'));
 assert.deepEqual((await prepared('notexistent business or product',items)).prepared.possibilities,[]);
});
test('categories cannot bypass price, exclusions, location, availability or unsupported temporal requirements',async()=>{
 const expensive=work('expensive','£160'),cheap=work('cheap');
 assert.deepEqual((await prepared('Fashion and Apparel Commerce black jacket under £100',[expensive,cheap])).prepared.possibilities.map(p=>p.workItemId),['cheap']);
 assert.deepEqual((await prepared('Fashion and Apparel Commerce jacket not black',[cheap])).prepared.possibilities,[]);
 assert.deepEqual((await prepared('Fashion and Apparel Commerce black jacket near London',[cheap])).prepared.possibilities,[]);
 assert.deepEqual((await prepared('Fashion and Apparel Commerce black jacket tomorrow',[cheap])).prepared.possibilities,[]);
 const unavailable=work();unavailable.products[0].availability='unavailable';unavailable.content='Unrelated';assert.deepEqual((await prepared(undefined,[unavailable])).prepared.possibilities,[]);
});
test('business classifications derive only from their own validated product/service references',()=>{
 const products=[{name:'Catering Services',description:'Published catering offer',categoryClassification:classification('89','5')},{name:'Cleaning Services',description:'Published cleaning offer',categoryClassification:classification('93','5')}];
 assert.deepEqual(classificationFromProducts(products).categories,[{categoryId:'89',sectorId:'5'},{categoryId:'93',sectorId:'5'}]);
 assert.equal(classificationFromProducts([{name:'Jacket',description:'Jacket',categoryClassification:classification('89','5')}]),null);
 const mixed=work();mixed.products.push({...mixed.products[0],productId:'other',businessId:'other-business',categoryClassification:classification('11')});
 assert.deepEqual(getValidPublicCustomerWork([mixed],20,{forSearchClassification:true})[0].categoryClassification.categories,[{categoryId:'10',sectorId:'1'}]);
});
test('classified search remains baseline by default, shadow invisible and candidate approval mandatory',async()=>{
 const state=await prepared(undefined,[work('a'),work('b')]);const baseline=state.prepared.possibilities;const tasks=[];
 const provider={intelligenceVersion:'category-ranker-v1',artifactFingerprint:'a'.repeat(64),rank:async input=>({ranked:input.candidates.slice().reverse().map((c,i)=>({possibilityId:c.possibilityId,score:1-i*.1}))})};
 assert.deepEqual(await completeCustomerSearch({...state,possibilities:baseline,configuration:{...state.configuration,mode:'candidate',provider,allowProviderRequest:true}}),baseline);
 assert.deepEqual(await completeCustomerSearch({...state,possibilities:baseline,configuration:{...state.configuration,mode:'shadow',provider,allowProviderRequest:true},defer:p=>tasks.push(p)}),baseline);await Promise.all(tasks);
 const approved={...state.configuration,mode:'candidate',provider,allowProviderRequest:true,resolveApproval:async()=>({approved:true,candidateVersion:provider.intelligenceVersion,purpose:'relevance-ranking',decisionId:'reviewed',artifactFingerprint:provider.artifactFingerprint,rollbackVersion:BASELINE_VERSION})};
 assert.deepEqual(await completeCustomerSearch({...state,possibilities:baseline,configuration:approved}),baseline.slice().reverse());
});
test('controlled classifications cannot become genuine production learning evidence',async()=>{
 const state=await prepared();let called=0;const evidence={authorize:async()=>{called++;},write:async()=>{called++;}};
 const result=await emitSearchEvidence({configuration:{...state.configuration,evidence},reference:state.prepared.reference,possibilities:state.prepared.possibilities,work:state.work,testMode:true});assert.equal(result.captured,false);assert.equal(called,0);
 assert.equal(state.configuration.evidence,null);
});
test('repository keeps classification only for internal catalogue validation without exposing private profile fields',async()=>{
 const item=work();const row={campaign_id:item.workItemId,business_id:item.businessId,campaign:{campaignType:'social',approvalStatus:'Approved',campaignText:item.content},profile:{profileVersion:4,name:item.businessName,products:item.products,customerContinuation:item.customerContinuation,privateEmail:'private@example.com'}};
 const repo=require('../api/_lib/persistence').createPersistenceRepository({ensureSchema:async()=>{},query:async()=>({rows:[row]})});const internal=await repo.getCustomerWork({forCatalogueValidation:true});assert.equal(internal[0].products[0].categoryClassification.categories[0].categoryId,'10');
 const publicRecords=await repo.getCustomerWork();assert.doesNotMatch(JSON.stringify(publicRecords),/categoryClassification|private@example/);
});

test('negated published category names cannot establish product classification',()=>{
 for(const evidence of ['Not Fashion and Apparel Commerce','No Fashion and Apparel Commerce','We do not offer Fashion and Apparel Commerce'])assert.equal(validateClassification(classification(),evidence),null);
 assert.deepEqual(interpretCategories('I do not need Fashion and Apparel Commerce').categoryIds,[]);
 assert.ok(validateClassification(classification(),'Not only Fashion and Apparel Commerce'));
});

test('category negation covers the whole bounded clause in requests and published offer evidence',()=>{
 const reference=classification('89','5');
 const negative=[
  'not Catering Services',
  'No Catering Services',
  'I do not want to use any Catering Services',
  'We do not currently intend to offer Catering Services',
  'We avoid offering any of the following Catering Services',
  'We operate without any plans to provide Catering Services',
  'We exclude from our currently published offers Catering Services',
  'We are excluding from all our available offers Catering Services',
  'We provide other services except for any form of Catering Services',
  'Not only other offers but we do not currently offer Catering Services'
 ];
 for(const text of negative){
  assert.deepEqual(interpretCategories(text).categoryIds,[],text);
  assert.equal(validateClassification(reference,text),null,text);
  assert.equal(classificationFromProducts([{name:'Published offer',description:text,categoryClassification:reference}]),null,text);
  const start=text.indexOf('Catering');
  assert.equal(validateCategoryAdvisory({datasetVersion:DATASET_VERSION,categories:[{categoryId:'89',start,end:start+'Catering Services'.length}]},text),null,text);
 }
});

test('punctuation bounds negation scope without losing legitimate positive category wording',()=>{
 for(const boundary of [';', '.', '!', '?', '\n', ',']){
  const text='We do not currently intend to offer Cleaning Services'+boundary+' Catering Services';
  assert.deepEqual(interpretCategories(text).categoryIds,['89'],JSON.stringify(boundary));
  assert.ok(validateClassification(classification('89','5'),text));
  assert.equal(validateClassification(classification('93','5'),text),null);
  const reverse='Catering Services'+boundary+' we do not currently intend to offer Cleaning Services';
  assert.deepEqual(interpretCategories(reverse).categoryIds,['89']);
 }
 for(const text of ['Fashion and Apparel Commerce','Not only Fashion and Apparel Commerce','We provide not only a wide range of Fashion and Apparel Commerce']){
  assert.deepEqual(interpretCategories(text).categoryIds,['10'],text);
  assert.ok(validateClassification(classification(),text),text);
  assert.deepEqual(classificationFromProducts([{name:'Published offer',description:text,categoryClassification:classification()}]).categories,[{categoryId:'10',sectorId:'1'}]);
 }
});

test('invalid or oversized category interpretations preserve the approved search universe',()=>{
 const items=[work()];
 for(const interpretation of [null,{datasetVersion:DATASET_VERSION,categoryIds:['172']},{datasetVersion:'wrong',categoryIds:['10']},{datasetVersion:DATASET_VERSION,categoryIds:['10','10']},{datasetVersion:DATASET_VERSION,categoryIds:Array.from({length:9},(_,i)=>String(i+1))}])assert.equal(selectCategoryWork(items,interpretation).work,items);
});
test('a classified service uses the existing presentation and search contracts',async()=>{
 const service=work('service');service.content='Catering Services';service.products[0]={...service.products[0],name:'Catering Services',description:'Published catering offer',categoryClassification:classification('89','5'),presentation:{categoryId:'services.appointments',pricing:{mode:'quote'},options:[],variants:[]}};
 const internal=getValidPublicCustomerWork([service],20,{forSearchClassification:true});assert.equal(internal[0].products[0].presentation.kind,'service');assert.equal(internal[0].categoryClassification.categories[0].categoryId,'89');
 const state=await prepared('Catering Services',[service]);assert.equal(state.prepared.possibilities[0].products[0].presentation.categoryId,'services.appointments');assert.doesNotMatch(JSON.stringify(state.prepared.possibilities),/categoryClassification|datasetVersion|sectorId/);
});
