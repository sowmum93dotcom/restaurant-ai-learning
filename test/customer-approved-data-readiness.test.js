'use strict';
// Isolated engineering rows; these are not genuine approved businesses.
const test=require('node:test'),assert=require('node:assert/strict');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {inspectCustomerPublication}=require('../api/_lib/customer-publication-rules');
const {prepareCustomerSearch}=require('../api/_lib/customer-search-service');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {toCustomerPossibility,toCustomerWorkItem}=require('../js/customer');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
function row(){return {campaign_id:'campaign',business_id:'owner',approved_at:new Date('2026-01-02T00:00:00Z'),campaign_updated_at:new Date('2026-01-02T00:00:00Z'),campaign:{id:'campaign',businessId:'owner',approvalStatus:'Approved',campaignType:'social',campaignText:'Published collection',media:[{assetId:'asset',role:'primary'}]},profile:{businessId:'owner',profileVersion:4,name:'Isolated fixture',location:'Manchester',informationStatus:{source:'business-owner',status:'business-provided',ownerConfirmedAt:'2026-01-01T00:00:00Z'},privateEmail:'private@example.org',customerContinuation:{routes:['website'],website:'https://example.org'},products:[{productId:'offer',businessId:'owner',name:'Black waterproof jacket',description:'Fashion and Apparel Commerce black waterproof jacket',price:'£89',availability:'available',continuationRoute:'website',categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:'10',sectorId:'1'}]}}]}};}
function asset(){return {assetId:'asset',businessId:'owner',state:'ready',kind:'image',purpose:'product',relatedEntityId:'offer',deliveryUrl:'https://example.org/asset.webp'};}
async function load(rows=[row()],assets=[asset()],report){const summaries=[],queries=[];
 const repository=createPersistenceRepository({ensureSchema:async()=>{},query:async(sql,parameters)=>{queries.push(sql);return {rows:parameters[1]===0?rows:[]};}},{reportCatalogueDiagnostics:report|| (summary=>summaries.push(summary))});
 repository.getBusinessMediaAssetsByIds=async()=>assets;
 const work=await repository.getCustomerWork({forCatalogueValidation:true});return {work,summaries,queries};
}
async function search(work,text='Fashion and Apparel Commerce black waterproof jacket') {return (await prepareCustomerSearch({work,understanding:confirmCustomerUnderstanding(buildCustomerUnderstanding('',text))})).possibilities;}
test('consistent approved joined records reach existing category, eligibility and customer receiving contracts',async()=>{
 const input=row(),before=structuredClone(input),loaded=await load([input]);assert.deepEqual(loaded.summaries,[]);
 assert.match(loaded.queries[0],/JOIN demeos_businesses/);assert.match(loaded.queries[0],/c\.approved_at, c\.updated_at AS campaign_updated_at/);
 const received=toCustomerPossibility((await search(loaded.work))[0]);assert.equal(received.products[0].productId,'offer');assert.equal(received.products[0].price,'£89');
 assert.equal(toCustomerWorkItem(loaded.work[0]).media[0].relatedEntityId,'offer');assert.deepEqual(input,before);
 assert.doesNotMatch(JSON.stringify(received),/private@example|ownerConfirmedAt|informationStatus|approved_at|diagnostic|businessId/);
});
test('approved service records use the same owned offer path and canonical registry',async()=>{
 const input=row();Object.assign(input.profile.products[0],{name:'Cleaning Services',description:'Cleaning Services professional cleaning appointment',categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:'93',sectorId:'5'}]},presentation:{categoryId:'services.appointments',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[],variants:[]}});
 const loaded=await load([input],[{...asset(),purpose:'service'}]);
 const result=toCustomerPossibility((await search(loaded.work,'Cleaning Services cleaning appointment'))[0]);
 assert.equal(result.products[0].productId,'offer');assert.equal(result.products[0].presentation.kind,'service');assert.equal(result.products[0].presentation.pricing.amount,89);
 assert.equal(loaded.work[0].media[0].relatedEntityId,'offer');assert.deepEqual(loaded.summaries,[]);
});
test('embedded identity conflicts cannot override database ownership or campaign identity',async()=>{
 for(const change of [r=>r.profile.businessId='foreign',r=>r.campaign.businessId='foreign',r=>r.campaign.id='another',r=>r.business_id='',r=>r.campaign_id=null]){
  const input=row();change(input);const loaded=await load([input]);assert.deepEqual(loaded.work,[]);assert.equal(loaded.summaries.length,1);
  assert.ok(Object.keys(loaded.summaries[0]).some(code=>['source_identity_mismatch','missing_source_identity'].includes(code)));
 }
});
test('missing public business fields and malformed declared offers fail closed',async()=>{
 for(const change of [r=>r.profile=null,r=>r.profile.name='',r=>r.profile.name={},r=>r.profile.products={privateToken:'secret'}]){
  const input=row();change(input);assert.deepEqual((await load([input])).work,[]);
 }
});
test('publication and explicit information provenance contradictions are rejected',async()=>{
 for(const change of [r=>r.campaign.approvalStatus='Pending',r=>r.campaign.campaignText='',r=>r.profile.informationStatus.status='unverified',r=>r.profile.informationStatus.source='customer',r=>r.profile.informationStatus.ownerConfirmedAt='not-a-date',r=>r.profile.informationStatus=null]){
  const input=row();change(input);const loaded=await load([input]);assert.deepEqual(loaded.work,[]);assert.ok(loaded.summaries[0]);
 }
});
test('changes since approval are review diagnostics and cannot silently revoke or grant approval',async()=>{
 const input=row();input.campaign_updated_at='2026-01-03T00:00:00Z';const loaded=await load([input]);
 assert.equal((await search(loaded.work)).length,1);assert.deepEqual(loaded.summaries,[{publication_changed_since_approval:1}]);
 input.campaign.approvalStatus='Unapproved';assert.deepEqual((await load([input])).work,[]);
});
test('legacy missing freshness metadata and optional location stay unknown rather than invented',async()=>{
 const input=row();delete input.approved_at;delete input.campaign_updated_at;delete input.profile.location;delete input.profile.informationStatus;
 const loaded=await load([input]);assert.equal(loaded.work[0].location,undefined);assert.deepEqual(loaded.summaries,[{information_provenance_unverified:1,location_unverified:1,freshness_unverified:1}]);
 assert.deepEqual(await search(loaded.work,'Fashion and Apparel Commerce black jacket near Manchester'),[]);
});
test('invalid media offer relationships are view-only while exact unavailable offer identity is preserved',async()=>{
 for(const change of [r=>r.profile.products[0].customerVisible=false,r=>r.profile.products[0].businessId='foreign',r=>r.profile.products=[]]){
  const input=row();change(input);const loaded=await load([input]);assert.equal(loaded.work[0].media[0].relatedEntityId,undefined);
  assert.equal(loaded.summaries[0].media_relationship_unverified,1);
 }
 const loaded=await load([row()],[{...asset(),relatedEntityId:'missing'}]);assert.equal(loaded.work[0].media[0].relatedEntityId,undefined);
 const unavailable=row();unavailable.profile.products[0].availability='unavailable';const work=(await load([unavailable])).work;
 assert.equal(work[0].media[0].relatedEntityId,'offer');assert.deepEqual(await search(work),[]);
});
test('unapproved or wrong-owner media cannot become approved business evidence',async()=>{
 for(const media of [{...asset(),state:'archived'},{...asset(),businessId:'foreign'}]){
  const loaded=await load([row()],[media]);assert.equal(loaded.work[0].media,undefined);assert.equal(loaded.summaries[0].media_unavailable,1);
  assert.equal((await search(loaded.work))[0].products[0].productId,'offer');
 }
});
test('diagnostics aggregate fixed codes once and never expose record content to customers or providers',async()=>{
 const first=row();first.profile.businessId='foreign';const second=row();second.campaign.approvalStatus='Pending';
 const loaded=await load([first,first,second]);assert.deepEqual(loaded.summaries,[{source_identity_mismatch:2,publication_ineligible:1}]);
 assert.ok(Object.isFrozen(loaded.summaries[0]));assert.doesNotMatch(JSON.stringify(loaded.summaries),/campaign|private@example|foreign|Isolated fixture|https|owner|£89/);
 assert.deepEqual(await search(loaded.work),[]);
});
test('synchronous and asynchronous diagnostic sink failure cannot alter deterministic catalogue eligibility',async()=>{
 const input=row();delete input.approved_at;
 for(const report of [()=>{throw Error('sink failure');},async()=>{throw Error('sink failure');}]){
  const loaded=await load([input],[asset()],report);assert.equal((await search(loaded.work)).length,1);
 }
 await new Promise(resolve=>setImmediate(resolve));
});
test('approved fixture records still obey budget, location, availability, category and exclusions',async()=>{
 const {work}=await load();for(const text of ['Fashion and Apparel Commerce jacket under £50','Fashion and Apparel Commerce jacket near London','Fashion and Apparel Commerce jacket not black','Electronics and Devices jacket'])assert.deepEqual(await search(work,text),[],text);
 assert.equal(inspectCustomerPublication(row()).eligible,true);
});
