const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('../js/customer-item-contract');
const fixtures=require('../api/_lib/controlled-customer-test-content').productExperienceTestContent;
const server=require('../api/_lib/customer-public-work-contract').getValidPublicCustomerWork;
const client=require('../js/customer').toCustomerWorkItem;
const copy=require('../js/demeos-item-presentation-copy');
const item=()=>fixtures()[0].products[0].presentation;
test('structured receiving contract rejects arbitrary categories, irrelevant options and invalid prices',()=>{
 for(const change of [p=>p.categoryId='arbitrary',p=>p.options[0].key='weight',p=>p.pricing.amount=Infinity,p=>p.pricing.currency='INVALID',p=>p.options[0].values.push(p.options[0].values[0]),p=>p.variants.push(p.variants[0]),p=>p.variants[0].selection.extra='unknown']) {
  const p=item();change(p);assert.equal(contract.normalize(p),null);
 }
 assert.equal(contract.pricing({mode:'range',currency:'GBP',min:20,max:10}),null);
 for(const mode of ['none','quote'])assert.deepEqual(contract.pricing({mode}),{mode});
});
test('selection resolves variant price and availability without inventing missing combinations',()=>{
 const p=contract.normalize(item());
 assert.equal(contract.resolve(p,'available',{}).canContinue,false);
 const limited=contract.resolve(p,'available',{size:'small',colour:'blue'});
 assert.equal(limited.availability,'limited');assert.equal(limited.pricing.amount,47);
 assert.equal(contract.resolve(p,'available',{size:'medium',colour:'black'}).canContinue,false);
 assert.equal(contract.resolve(p,'unavailable',{size:'small',colour:'black'}).canContinue,false);
 const running=contract.normalize(fixtures()[2].products[0].presentation);
 assert.equal(contract.resolve(running,'available',{duration:'minutes60',people:'twoPeople'}).canContinue,false);
});
test('all controlled presentations survive server and client validation with exact media ownership',()=>{
 const work=server(fixtures());assert.equal(work.length,6);
 for(const business of work){const received=client(business);assert.ok(received);assert.deepEqual(received.products?.map(p=>p.presentation),business.products?.map(p=>p.presentation));}
 const grocery=work.find(w=>w.workItemId==='test-discover-groceries');assert.equal(grocery.products[0].imageUrl,undefined);assert.equal(grocery.media[0].purpose,'business');
});
test('nine-language structured copy has every category, field, value and system label',()=>{
 assert.deepEqual(Object.keys(copy).sort(),['ar','de','en','es','fr','hi','ja','pt','zh']);
 function check(a,b){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a)){if(typeof a[k]==='object')check(a[k],b[k]);else assert.ok(typeof b[k]==='string'&&b[k].trim());}}
 for(const table of Object.values(copy))check(copy.en,table);
});
