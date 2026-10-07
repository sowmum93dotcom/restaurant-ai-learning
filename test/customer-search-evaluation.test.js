const test = require('node:test');
const assert = require('node:assert/strict');
const {findCustomerPossibilities} = require('../api/_lib/customer-possibility-contract.js');
const {selectCustomerCatalogue} = require('../api/_lib/customer-catalogue.js');
const {buildCustomerUnderstanding, confirmCustomerUnderstanding} = require('../js/customer-understanding.js');
const request = text => confirmCustomerUnderstanding(buildCustomerUnderstanding('', text));
const work = (id, content, location='London') => ({workItemId:id,businessName:id,content,location,participationAction:'Interested'});
const catalogue = [work('quiet','Quiet restaurant for family dinner'),work('loud','Lively restaurant for family dinner'),
  work('relaxed','Relaxing place to spend time together'),work('party','Busy group celebration together'),
  work('repair','Bicycle repair with home collection'),work('rental','Bicycle rental'),
  work('paris','Quiet restaurant for family dinner','Paris'),
  work('massage','Massage and wellness appointment'),work('gym','Fitness and wellness session'),
  work('hotel','Hotel stay for your journey'),work('trip','Travel journey and guided visit'),
  work('breakfast','Breakfast in our restaurant')];
// Judged requests are intentionally separate from implementation vocabulary.
// Both false positives and missed relevant offers fail this evaluation.
const judgments = [
  ['quiet dinner','London',['quiet']], ['not quiet dinner','London',['loud']],
  ['dinner not a peaceful place','London',['loud']], ['peaceful dinner','London',['quiet']],
  ['relaxed place together','London',['relaxed']], ['relaxing place together','London',['relaxed']],
  ['bicycle repair with home collection','London',['repair']],
  ['bicycle rental','London',['rental']], ['quiet dinner','Paris',['paris']],
  ['quiet dinner','Unknown',[]], ['bicycle repair without collection','London',[]],
  ['massage','London',['massage']], ['fitness','London',['gym']],
  ['hotel','London',['hotel']], ['breakfast','London',['breakfast']],
  ['spa with sauna','London',[]], ['the business today','London',[]]
];
for (const [text,place,expected] of judgments) test(`judged search: ${text} / ${place}`, () => {
  assert.deepEqual(findCustomerPossibilities(request(text),catalogue,5,[],[],place).map(x=>x.workItemId).sort(),expected.sort());
});
const previewRequest={query:{'demeos-test':'1'},headers:{'x-demeos-test-mode':'controlled-preview'}};
test('Discover and request matching share supplied products, without invented capabilities',()=>{
  const selected=selectCustomerCatalogue([],previewRequest);
  assert.equal(selected.testMode,true);
  for(const [text,product] of [['jacket','test-product-mens-fashion'],['dress','test-product-summer-fashion'],['camping','test-product-camping']]) {
    const results=findCustomerPossibilities(request(text),selected.work);
    assert.equal(results.length,1);
    assert.ok(results[0].products.some(x=>x.productId===product));
  }
  assert.deepEqual(findCustomerPossibilities(request('quiet dinner'),selected.work),[]);
});
test('published catalogue replaces examples and activation needs both query and header',()=>{
  const published=[work('real','Quiet family dinner')];
  assert.deepEqual(selectCustomerCatalogue(published,previewRequest),{work:published,testMode:false});
  assert.equal(selectCustomerCatalogue([],{query:previewRequest.query}).testMode,false);
  assert.equal(selectCustomerCatalogue([],{headers:previewRequest.headers}).testMode,false);
  const previous=process.env.DEMEOS_CONTROLLED_TEST_CONTENT;
  try {process.env.DEMEOS_CONTROLLED_TEST_CONTENT='disabled';assert.equal(selectCustomerCatalogue([],previewRequest).testMode,false);}
  finally {if(previous===undefined)delete process.env.DEMEOS_CONTROLLED_TEST_CONTENT;else process.env.DEMEOS_CONTROLLED_TEST_CONTENT=previous;}
});

test('running a workshop does not recommend running-session fixtures', () => {
  const selected=selectCustomerCatalogue([],previewRequest);
  assert.deepEqual(findCustomerPossibilities(request('running a workshop'),selected.work),[]);
  assert.equal(findCustomerPossibilities(request('running'),selected.work).length,1);
  assert.equal(findCustomerPossibilities(request('jogging'),selected.work).length,1);
});
test('not only is not an exclusion', () => {
  assert.deepEqual(findCustomerPossibilities(request('not only quiet dinner'),[work('quiet','Quiet dinner')]).map(x=>x.workItemId),['quiet']);
});
