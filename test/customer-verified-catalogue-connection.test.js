'use strict';
// Engineering records only; no real business data or external provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const {createPersistenceRepository} = require('../api/_lib/persistence');
const {prepareCustomerSearch} = require('../api/_lib/customer-search-service');
const {selectCategoryWork, interpretCategories} = require('../api/_lib/customer-category-classification');
const {getValidPublicCustomerWork} = require('../api/_lib/customer-public-work-contract');
const {suggestPublishedOfferCategories} = require('../api/_lib/customer-category-understanding');
const {DATASET_VERSION} = require('../api/_lib/marketing-agent-categories');
const {buildCustomerUnderstanding, confirmCustomerUnderstanding} = require('../js/customer-understanding');
const {toCustomerPossibility, toCustomerWorkItem} = require('../js/customer');
const {resolve} = require('../js/customer-item-contract');
function record() {
  return {campaign_id:'campaign',business_id:'business',campaign:{campaignType:'social',approvalStatus:'Approved',campaignText:'Published collection',media:[{assetId:'image',role:'primary'}]},
    profile:{profileVersion:4,name:'Engineering fixture',location:'Manchester',privateEmail:'private@example.org',customerContinuation:{routes:['website'],website:'https://example.org/collection'},products:[{
      productId:'jacket',businessId:'business',name:'Black waterproof jacket',description:'Fashion and Apparel Commerce black waterproof jacket',price:'£89',availability:'available',continuationRoute:'website',imageUrl:'https://example.org/jacket.webp',
      categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:'10',sectorId:'1'}]},
      presentation:{categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'jacket-m',selection:{size:'M'},availability:'available'}]}
    }]}};
}
function media() {return {assetId:'image',businessId:'business',kind:'image',state:'ready',purpose:'product',relatedEntityId:'jacket',deliveryUrl:'https://example.org/master.webp',derivatives:[{role:'customer',deliveryUrl:'https://example.org/customer.webp',contentType:'image/webp',relatedEntityId:'wrong'}]};}
async function catalogue(row=record(),assets=[media()]) {
  const repository=createPersistenceRepository({ensureSchema:async()=>{},query:async sql=>({rows:sql.includes('SELECT c.campaign_id')?[row]:[]})});
  repository.getBusinessMediaAssetsByIds=async()=>assets;
  return repository.getCustomerWork({forCatalogueValidation:true});
}
async function search(work,text='Fashion and Apparel Commerce black waterproof jacket') {
  return (await prepareCustomerSearch({work,understanding:confirmCustomerUnderstanding(buildCustomerUnderstanding('',text))})).possibilities;
}
test('authoritative approved records reach search and existing receiver with exact offer, price, options and continuation',async()=>{
  const row=record(),before=structuredClone(row),work=await catalogue(row);
  const result=(await search(work))[0],received=toCustomerPossibility(result);
  assert.equal(received.workItemId,'campaign');assert.equal(received.products[0].productId,'jacket');
  assert.equal(received.products[0].price,'£89');assert.equal(received.customerContinuation.website,'https://example.org/collection');
  assert.equal(received.products[0].imageUrl,row.profile.products[0].imageUrl);
  const selected=resolve(received.products[0].presentation,'available',{size:'M'});
  assert.equal(selected.canContinue,true);assert.equal(selected.availability,'available');
  assert.deepEqual(received.products[0].presentation.variants[0].selection,{size:'M'});
  assert.doesNotMatch(JSON.stringify(result),/private@example|categoryClassification|businessId|hasDeclaredOffers/);assert.deepEqual(row,before);
});
test('approved derivative retains asset-owned product relationship through repository and Customer Experience receiver',async()=>{
  const work=await catalogue(),received=toCustomerWorkItem(work[0]);
  assert.equal(received.media[0].relatedEntityId,'jacket');assert.equal(received.media[0].purpose,'product');
  assert.equal(received.media[0].deliveryUrl,'https://example.org/customer.webp');
});
test('unpublished campaigns cannot enter the authoritative catalogue',async()=>{
  for(const status of ['Draft','Pending','Rejected']){const row=record();row.campaign.approvalStatus=status;assert.deepEqual(await catalogue(row),[]);}
});
test('unavailable, hidden and wrong-owner offers never produce product search continuation',async()=>{
  for(const mutate of [p=>p.availability='unavailable',p=>p.customerVisible=false,p=>p.businessId='foreign']){
    const row=record();mutate(row.profile.products[0]);assert.deepEqual(await search(await catalogue(row)),[]);
  }
});
test('campaign headlines cannot substitute for missing eligible declared offers',async()=>{
  for(const mutate of [p=>p.availability='unavailable',p=>p.customerVisible=false,p=>p.businessId='foreign',p=>p.continuationRoute='phone']){
    const row=record();row.campaign.campaignText='Black waterproof jacket';mutate(row.profile.products[0]);
    assert.deepEqual(await search(await catalogue(row)),[]);
    // Raw authoritative records also retain rejected offer declarations.
    const raw={workItemId:row.campaign_id,businessId:row.business_id,businessName:row.profile.name,content:row.campaign.campaignText,participationAction:'Interested',customerContinuation:row.profile.customerContinuation,products:row.profile.products};
    assert.deepEqual(await search([raw]),[]);
  }
});
test('missing or unapproved media does not invent an image or suppress a valid independently owned offer',async()=>{
  for(const assets of [[],[{...media(),state:'processing'}],[{...media(),businessId:'foreign'}]]){
    const work=await catalogue(record(),assets);assert.equal(work[0].media,undefined);assert.equal((await search(work))[0].products[0].productId,'jacket');
  }
});
test('category mismatch, location, budget and exclusions preserve deterministic eligibility',async()=>{
  const work=await catalogue();
  for(const text of ['Electronics and Devices black jacket','Fashion and Apparel Commerce black jacket under £50','Fashion and Apparel Commerce jacket not black','Fashion and Apparel Commerce black jacket near London'])assert.deepEqual(await search(work,text),[],text);
});
test('duplicate normalized offer identifiers are rejected before repository projection and category narrowing',async()=>{
  const row=record();row.profile.products.push({...row.profile.products[0],productId:' jacket ',name:'Unclassified sibling',description:'Electronics and Devices jacket',categoryClassification:undefined});
  const work=await catalogue(row);assert.equal(work[0].products,undefined);assert.deepEqual(await search(work),[]);
  const raw={workItemId:'w',businessId:'business',businessName:'Fixture',content:'Collection',participationAction:'Interested',customerContinuation:row.profile.customerContinuation,products:row.profile.products};
  assert.equal(selectCategoryWork([raw],interpretCategories('Fashion and Apparel Commerce')).work[0].products.length,0);
});
test('duplicate normalized work identifiers cannot borrow another business classification or continuation',async()=>{
  const work=await catalogue(),other={...work[0],workItemId:' campaign ',businessId:'other'};
  assert.deepEqual(getValidPublicCustomerWork([...work,other]),[]);assert.deepEqual(await search([...work,other]),[]);
  assert.deepEqual(selectCategoryWork([...work,other],interpretCategories('Fashion and Apparel Commerce')).work,[]);
});
test('unique normalized source identifiers preserve exact raw records during category narrowing',async()=>{
  const work=await catalogue();work[0].workItemId=' campaign ';work[0].products[0].productId=' jacket ';
  const selected=selectCategoryWork(work,interpretCategories('Fashion and Apparel Commerce')).work;
  assert.equal(selected[0].products[0],work[0].products[0]);assert.equal((await search(selected))[0].products[0].productId,'jacket');
});
test('advisory classification refuses ambiguous source identities before any approval or provider service',async()=>{
  const work=await catalogue();let calls=0;const configuration={mode:'approved',allowProviderRequest:true,provider:{classify:async()=>{calls++;}}};
  for(const ambiguous of [[...work,{...work[0],workItemId:' campaign '}],[{...work[0],products:[...work[0].products,{...work[0].products[0],productId:' jacket '}]}]]){
    const result=await suggestPublishedOfferCategories({work:ambiguous,workItemId:'campaign',productId:'jacket',configuration});assert.equal(result.reason,'published_offer_missing');
  }
  assert.equal(calls,0);
});
