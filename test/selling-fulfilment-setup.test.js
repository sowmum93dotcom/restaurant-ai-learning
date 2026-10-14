'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {validateProfile}=require('../api/businesses/[businessId]');
const {preserveSellingContinuation}=require('../js/script');
const {keys,copy}=require('../js/selling-business-setup-copy');
const profile={businessId:'vendor',name:'Vendor',type:'Clothing',location:'London',profileVersion:4,preparationModel:'selling',offeringCategoryId:'fashion.apparel',productsServices:'Jackets',customerContinuation:{routes:[]},fulfilment:{methods:['shipping'],notes:'Dispatch Monday to Friday'},operationalAvailability:{status:'available'},products:[]};
const validate=value=>validateProfile({body:{businessProfile:value},query:{businessId:'vendor'}});
test('Selling can save fulfilment without external customer routes and receives no activation authority',()=>{
 const result=validate({...profile,applicationAccess:{selling:true},canSell:true});assert.ok(result);assert.deepEqual(result.customerContinuation.routes,[]);assert.equal(result.applicationAccess,undefined);assert.equal(result.canSell,undefined);assert.deepEqual(result.fulfilment,profile.fulfilment);
});
test('Marketing and Both retain their required external route contract',()=>{
 for(const preparationModel of ['marketing','both'])assert.equal(validate({...profile,preparationModel,brandVoice:'Clear',targetCustomer:'Customers',goal:'Awareness'}),null);
});
test('Selling still rejects malformed external destinations and fulfilment facts',()=>{
 for(const change of [{customerContinuation:{routes:['unknown']}},{customerContinuation:{routes:['website'],website:'javascript:bad'}},{customerContinuation:{routes:'website'}},{fulfilment:{methods:[]}},{fulfilment:{methods:['unknown']}}])assert.equal(validate({...profile,...change}),null);
});
test('existing shared Marketing routes are preserved by value and new Selling has no invented external route',()=>{
 const original={customerContinuation:{routes:['website'],website:'https://example.org'}};
 const result=preserveSellingContinuation(original);assert.deepEqual(result,original.customerContinuation);result.routes.push('email');assert.deepEqual(original.customerContinuation.routes,['website']);assert.deepEqual(preserveSellingContinuation(null),{routes:[]});
});
test('Selling fulfilment copy covers all nine languages and actual controls without enquiry setup',()=>{
 assert.equal(Object.keys(copy).length,9);for(const values of Object.values(copy)){assert.equal(values.length,keys.length);assert.ok(values.every(v=>typeof v==='string'&&v.trim()));}
 const html=fs.readFileSync('selling-vendor-manage.html','utf8');assert.doesNotMatch(html,/id="business-route-|id="business-website"|id="business-booking-link"|Available for new customer enquiries/);
 for(const match of html.matchAll(/data-selling-setup-(?:copy|placeholder)="([^"]+)"/g))assert.ok(keys.includes(match[1]));
 assert.match(html,/id="business-fulfilment-shipping"/);assert.match(html,/id="business-availability-status"/);
});

test('a Selling draft product can be prepared without an external ordering destination',()=>{
 const products=[{productId:'jacket',name:'Jacket',description:'Vendor supplied jacket',priceMode:'fixed',price:'£89',continuationRoute:'',availability:'available',customerVisible:false}];
 const result=validate({...profile,products});assert.ok(result);assert.equal(result.products[0].continuationRoute,'');
 assert.equal(validate({...profile,preparationModel:'both',brandVoice:'Clear',targetCustomer:'Customers',goal:'Awareness',customerContinuation:{routes:['website'],website:'https://example.org'},products}),null);
});
