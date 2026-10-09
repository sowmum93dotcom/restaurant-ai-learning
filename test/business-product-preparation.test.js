'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preserveProduct,priceText}=require('../js/business-product-preparation');
const contract=require('../js/customer-item-contract');
const {prepareBusinessDraft}=require('../api/_lib/business-marketing-draft');
const presentation={categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:45},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'exact-m',selection:{size:'M'},availability:'limited',pricing:{mode:'fixed',currency:'GBP',amount:49}}]};
test('a legacy product edit preserves omitted structured data and private extensions without taking incoming unknown fields',()=>{
 const previous={productId:'exact',description:'Old',privateExtension:{reference:'retained'},presentation:{...presentation,extension:{source:'existing'}}};
 const edited=preserveProduct(previous,{productId:'exact',description:'Updated'});assert.equal(edited.description,'Updated');assert.deepEqual(edited.presentation,previous.presentation);assert.deepEqual(edited.privateExtension,previous.privateExtension);
 edited.presentation.options[0].values[0].label='Changed copy';assert.equal(previous.presentation.options[0].values[0].label,'Medium');
});
test('supported option and variant edits keep exact values, IDs and saved future fields',()=>{
 const previous={productId:'exact',presentation:{...presentation,extension:'retained',options:[{...presentation.options[0],values:[{...presentation.options[0].values[0],future:'saved'}]}],variants:[{...presentation.variants[0],future:'saved'}]}};
 const changed=contract.normalize({...presentation,options:[{key:'size',values:[{value:'M',label:'Medium fit'},{value:'L',label:'Large'}]}],variants:[{...presentation.variants[0],availability:'unavailable'}]});
 const result=preserveProduct(previous,{productId:'exact',presentation:changed});assert.equal(result.presentation.extension,'retained');assert.equal(result.presentation.options[0].values[0].future,'saved');assert.equal(result.presentation.variants[0].variantId,'exact-m');assert.equal(result.presentation.variants[0].future,'saved');assert.equal(result.presentation.variants[0].availability,'unavailable');assert.equal(contract.resolve(result.presentation,'available',{size:'L'}).canContinue,false);
 assert.throws(()=>preserveProduct(previous,{presentation:contract.normalize({categoryId:'family.toys',pricing:presentation.pricing})}),/category/);
});
test('draft pricing and variant labels use saved structured facts rather than conflicting legacy display text',()=>{
 const record={businessProfile:{businessId:'owned',name:'Saved business',customerContinuation:{routes:['website']},products:[{businessId:'owned',productId:'exact',name:'Saved jacket',description:'Saved fabric description',price:'£999',priceMode:'fixed',availability:'contact',continuationRoute:'website',presentation}]}};
 const draft=prepareBusinessDraft(record,'owned','exact');assert.match(draft.campaign,/45 GBP/);assert.match(draft.campaign,/Medium: 49 GBP\. Limited availability/);assert.doesNotMatch(draft.campaign,/999|certified|discount|in stock/i);assert.equal(draft.preparationOnly,true);
 record.businessProfile.products[0].presentation.pricing.amount=-1;assert.equal(prepareBusinessDraft(record,'owned','exact'),null);
});
test('service drafts keep authoritative appointment choices without fabricated dates or availability',()=>{
 const record={businessProfile:{businessId:'owned',name:'Saved business',products:[{businessId:'owned',productId:'service',name:'Consultation',description:'Owner provided service',price:'',priceMode:'contact',availability:'contact',presentation:{categoryId:'services.appointments',pricing:{mode:'quote'},options:[{key:'duration',values:[{value:'60',label:'60 minutes'}]}],variants:[]}}]}};
 const draft=prepareBusinessDraft(record,'owned','service');assert.match(draft.campaign,/Duration: 60 minutes/);assert.match(draft.campaign,/Contact the business for pricing/);assert.match(draft.campaign,/confirm availability/);assert.equal(prepareBusinessDraft(record,'foreign','service'),null);
});
test('pricing summaries preserve zero, currency, range and quote states',()=>{
 assert.equal(priceText({mode:'fixed',currency:'JPY',amount:0}),'0 JPY');assert.equal(priceText({mode:'range',currency:'EUR',min:10,max:20}),'10 EUR – 20 EUR');assert.match(priceText({mode:'quote'}),/Contact/);assert.equal(priceText({mode:'range',currency:'GBP',min:20,max:10}),'');
});
