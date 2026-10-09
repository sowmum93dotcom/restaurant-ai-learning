'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {prepareCustomerSearch,completeCustomerSearch}=require('../api/_lib/customer-search-service');
const {getCustomerSearchConfiguration}=require('../api/_lib/customer-search-registry');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {toCustomerPossibility}=require('../js/customer');
const {sourceRow}=require('./fixtures/approved-search-source.cjs');
const {inspectCustomerPublication}=require('../api/_lib/customer-publication-rules');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
const understanding=text=>confirmCustomerUnderstanding(buildCustomerUnderstanding('',text));
async function search(work,text='Fashion and Apparel Commerce black jacket under £100',locale='en',configuration=getCustomerSearchConfiguration()) {
 const input={work,understanding:understanding(text),locale,configuration};
 const prepared=await prepareCustomerSearch(input);
 return {prepared,results:await completeCustomerSearch({...input,prepared,possibilities:prepared.possibilities,testMode:false})};
}
function repository(rows) {
 const queries=[];
 const repo=createPersistenceRepository({ensureSchema:async()=>{},query:async(sql,args)=>{queries.push(args);return {rows:rows.slice(args[1],args[1]+args[0])};}},{reportCatalogueDiagnostics:()=>{}});
 return {repo,queries};
}
test('search retrieves later eligible records before the result cap without changing the Discover feed',async()=>{
 const rows=Array.from({length:61},(_,index)=>sourceRow(index));
 for(const row of rows.slice(0,60))row.profile.products[0].availability='unavailable';
 const {repo,queries}=repository(rows);
 const feed=await repo.getCustomerWork({forCatalogueValidation:true});assert.equal(feed.length,20);
 queries.length=0;
 const work=await repo.getCustomerWork({forSearch:true});assert.equal(work.length,61);assert.deepEqual(queries,[[50,0],[50,50]]);
 const {results}=await search(work);assert.equal(results.length,1);
 const received=toCustomerPossibility(results[0]);assert.equal(received.workItemId,rows[60].campaign_id);assert.equal(received.products[0].productId,rows[60].profile.products[0].productId);
 assert.equal(received.products[0].price,'£89');assert.equal(received.products[0].presentation.pricing.amount,89);assert.deepEqual(received.products[0].presentation.variants[0].selection,{size:'M'});
 assert.doesNotMatch(JSON.stringify(results),/private@example|private-token|businessId|ownerConfirmedAt|categoryClassification/);
});
test('search bounds eligible candidates and source pagination independently, including invalid-page history',async()=>{
 const rows=Array.from({length:1100},(_,index)=>sourceRow(index));
 let loaded=repository(rows),work=await loaded.repo.getCustomerWork({forSearch:true});assert.equal(work.length,200);assert.equal(loaded.queries.length,4);
 assert.equal((await search(work)).results.length,5);
 for(const row of rows)row.profile.businessId='wrong-owner';
 loaded=repository(rows);work=await loaded.repo.getCustomerWork({forSearch:true});assert.deepEqual(work,[]);assert.equal(loaded.queries.length,20);assert.deepEqual(loaded.queries.at(-1),[50,950]);assert.deepEqual((await search(work)).results,[]);
});
test('all nine locales preserve later product and service identity and deterministic ordering',async()=>{
 const rows=Array.from({length:55},(_,index)=>sourceRow(index,{service:index===54}));
 const {repo}=repository(rows),work=await repo.getCustomerWork({forSearch:true});
 for(const locale of LOCALES){
  const product=await search(work,undefined,locale);assert.equal(product.prepared.intention.locale,locale);assert.equal(product.results.length,5);
  const service=await search(work,'Cleaning Services cleaning appointment',locale);assert.equal(service.results.length,1);assert.equal(service.results[0].products[0].productId,'fixture-offer-54');assert.equal(service.results[0].products[0].presentation.kind,'service');
  assert.deepEqual(service.results,(await search(work,'Cleaning Services cleaning appointment',locale)).results);
 }
});
test('later candidates obey exclusions, price, location and empty-result requirements',async()=>{
 const {repo}=repository(Array.from({length:55},(_,index)=>sourceRow(index))),work=await repo.getCustomerWork({forSearch:true});
 for(const text of ['Fashion and Apparel Commerce jacket not black','Fashion and Apparel Commerce jacket under £50','Fashion and Apparel Commerce jacket near Paris','Cleaning Services cleaning appointment'])assert.deepEqual((await search(work,text)).results,[],text);
});
test('controlled identities and supplied controlled media cannot be promoted by a stored Approved flag',async()=>{
 for(const mutate of [r=>r.business_id='test-business-fashion',r=>r.campaign_id='test-discover-fashion',r=>r.profile.products[0].productId='test-product-mens-fashion',r=>r.profile.products[0].imageUrl='https://www.demeos.io/images/controlled-test/mens-fashion.webp',r=>r.campaign.media=[{assetId:'test-media-activewear',role:'primary'}]]){
  const row=sourceRow(1);mutate(row);assert.equal(inspectCustomerPublication(row).eligible,false);assert.ok(inspectCustomerPublication(row).reasons.includes('controlled_content_not_genuine'));
  assert.deepEqual(await repository([row]).repo.getCustomerWork({forSearch:true}),[]);
 }
});
test('unapproved semantic configuration falls back deterministically and default configuration has no external provider',async()=>{
 const {repo}=repository([sourceRow(1)]),work=await repo.getCustomerWork({forSearch:true});
 const baseline=await search(work);let calls=0;
 const configuration={...getCustomerSearchConfiguration(),understanding:{mode:'approved',version:'unapproved',allowProviderRequest:true,provider:{intelligenceVersion:'unapproved',understand:async()=>{calls++;throw Error('must not run');}}}};
 assert.deepEqual((await search(work,undefined,'en',configuration)).results,baseline.results);assert.equal(calls,0);
 assert.equal(getCustomerSearchConfiguration().categoryUnderstanding,null);assert.equal(getCustomerSearchConfiguration().provider,null);
});
