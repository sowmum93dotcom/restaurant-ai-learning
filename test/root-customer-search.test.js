'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const root=require('../api/_lib/root-intelligence');
const {validateConfirmedUnderstanding}=require('../api/_lib/customer-possibility-contract');
const body={action:'search-customer',audience:'customer',locale:'en',text:'black waterproof jacket under £100',confirmed:true};
async function invoke({input=body,identity='external-root-user',env='preview',delegate,query={},headers={}}={}){
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 await root.createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,environment:()=>({VERCEL_ENV:env}),repository:()=>{throw Error('ROOT must not open Selling data');},customerSearchHandler:delegate})({method:'POST',url:'/api/root/workspace',query,headers:{'content-type':'application/json',authorization:'Bearer current-user',host:'preview.example',...headers},body:input},response);
 return response;
}
test('ROOT requires Customer audience, current confirmation, bounded text and trusted identity before search delegation',async()=>{
 let calls=0;const delegate=async(req,res)=>{calls++;res.status(200).json({possibilities:[]});};
 for(const patch of [{audience:'business'},{confirmed:false},{text:''},{text:'x'.repeat(501)},{locale:'xx'},...['businessId','tenantId','workspaceId','customerId','provider','mode','categoryId','executor'].map(key=>({[key]:'forged'}))]){
  const result=await invoke({input:{...body,...patch},delegate});assert.ok([400,403].includes(result.code));
 }
 assert.equal((await invoke({identity:null,delegate})).code,401);
 assert.equal((await invoke({env:'production',delegate})).code,503);assert.equal(calls,0);
});
test('delegation sends only a canonical confirmed request and preserves independent Customer Experience authority',async()=>{
 const response=await invoke({input:{...body,text:'  black   jacket  ',locale:'ar'},query:{'demeos-test':'1'},headers:{'x-demeos-test-mode':'controlled-preview','x-demeos-discover-test':'controlled-preview'},delegate:async(req,res)=>{
  assert.equal(req.url,'/api/customer/possibilities');assert.equal(req.method,'POST');assert.deepEqual(req.query,{});
  assert.equal(req.headers.authorization,'Bearer current-user');assert.equal(req.headers['x-demeos-customer-locale'],'ar');assert.equal(req.headers['x-demeos-test-mode'],undefined);assert.equal(req.headers['x-demeos-discover-test'],undefined);
  assert.deepEqual(Object.keys(req.body),['understanding']);assert.equal(validateConfirmedUnderstanding(req.body).customerText,'black jacket');
  assert.equal(req.body.trustedIdentityId,undefined);res.status(200).json({possibilities:[]});
 }});
 assert.equal(response.code,200);assert.equal(response.body.workspace.organisationAccess,false);assert.equal(response.body.workspace.audience,'customer');assert.deepEqual(response.body.search,{possibilities:[]});assert.equal(response.headers['Cache-Control'],'private, no-store');
});
test('Customer Experience denial and dependency failure do not leak internal responses or become successful search',async()=>{
 const denied=await invoke({delegate:async(req,res)=>res.status(403).json({error:'private internal detail'})});assert.equal(denied.code,403);assert.deepEqual(denied.body,{code:'customer-search-unavailable'});
 const malformed=await invoke({delegate:async(req,res)=>res.status(200).json({privateData:'not-search-results'})});assert.equal(malformed.code,503);
 const broken=await invoke({delegate:async()=>{throw Error('database credential');}});assert.equal(broken.code,503);assert.doesNotMatch(JSON.stringify(broken.body),/credential|privateData/);
});

const item=(id,price='£89',availability='available')=>({workItemId:id,businessId:'business-'+id,businessName:'Published '+id,content:'Black waterproof jacket',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:'Black jacket',description:'Black waterproof jacket',availability,price,continuationRoute:'website'}]});
async function actual({work=[item('expensive','£160'),item('cheap'),item('unavailable','£60','unavailable')],owner=false,empty=false}={}){
 const persistence=require('../api/_lib/persistence'),authentication=require('../api/_lib/demeos-customer-authentication'),trust=require('../api/_lib/customer-possibility-issuance-trust');
 const original={repository:persistence.getRepository,identity:authentication.resolveTrustedCustomerIdentityFromRequest,prepare:trust.prepareCustomerPossibilityIssuanceTrust,confirm:trust.confirmCustomerPossibilityIssuanceDelivery};let recorded=0,privacy=0;
 persistence.getRepository=()=>({getCustomerWork:async(options)=>{assert.deepEqual(options,{forCatalogueValidation:true,forSearch:true});return empty?[]:work;},getOwnedBusinessIds:async identity=>{assert.equal(identity,'independently-verified-customer');return owner?['owned-business']:[];},saveCustomerIntention:async(identity,input)=>{assert.equal(identity,'independently-verified-customer');assert.equal(input.customerText,body.text);recorded++;return {intentionId:'confirmed-search'};},getCustomerPrivacyControls:async()=>{privacy++;return {usePreferencesAsGuidance:false,useFeedbackAsGuidance:false};},getCustomerPreferences:async()=>{throw Error('private preferences must not be read');},getCustomerFeedback:async()=>{throw Error('private feedback must not be read');},recordCustomerPossibilityIssuance:async(identity,rows)=>{assert.equal(identity,'independently-verified-customer');return rows.map(row=>row.workItemId);}});
 authentication.resolveTrustedCustomerIdentityFromRequest=async req=>{assert.equal(req.headers.authorization,'Bearer current-user');return {trustedCustomerIdentityId:'independently-verified-customer'};};
 trust.prepareCustomerPossibilityIssuanceTrust=async()=>{};trust.confirmCustomerPossibilityIssuanceDelivery=async(identity,ids)=>ids;
 const path=require.resolve('../api/customer/possibilities');delete require.cache[path];
 try{return {...await invoke({delegate:require(path),query:{'demeos-test':'1'},headers:{'x-demeos-test-mode':'controlled-preview'}}),recorded,privacy};}
 finally{persistence.getRepository=original.repository;authentication.resolveTrustedCustomerIdentityFromRequest=original.identity;trust.prepareCustomerPossibilityIssuanceTrust=original.prepare;trust.confirmCustomerPossibilityIssuanceDelivery=original.confirm;delete require.cache[path];}
}
test('ROOT crosses the real existing search handler, catalogue validator, budget filter and issuance boundary',async()=>{
 const response=await actual();assert.equal(response.code,200);assert.deepEqual(response.body.search.possibilities.map(row=>row.workItemId),['cheap']);assert.equal(response.recorded,1);assert.equal(response.privacy,1);
 assert.doesNotMatch(JSON.stringify(response.body.search),/businessId|business-cheap|trustedCustomer|modelExecuted|shadowOrdering/);
});
test('vendor identity does not gain customer history and ROOT cannot turn an empty catalogue into demo matches',async()=>{
 const owner=await actual({owner:true});assert.equal(owner.code,200);assert.equal(owner.recorded,0);assert.equal(owner.privacy,0);
 const empty=await actual({empty:true});assert.equal(empty.code,200);assert.deepEqual(empty.body.search,{possibilities:[]});assert.equal(empty.body.search.testMode,undefined);
});
