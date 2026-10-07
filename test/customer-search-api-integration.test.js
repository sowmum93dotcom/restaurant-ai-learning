'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {getCustomerSearchConfiguration}=require('../api/_lib/customer-search-registry');
const persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-customer-authentication'),trust=require('../api/_lib/customer-possibility-issuance-trust');
const item=(id,price='£89')=>({workItemId:id,businessId:'business-'+id,businessName:'Approved',content:'Black waterproof jacket',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:'Black jacket',description:'Black waterproof jacket',availability:'available',price,continuationRoute:'website'}]});
async function post({query='jacket',work=[item('a'),item('b')],configuration=getCustomerSearchConfiguration(),identity=null,reqExtra={},confirmedIds}={}){
 const tasks=[],original={repository:persistence.getRepository,identity:auth.resolveTrustedCustomerIdentityFromRequest,prepare:trust.prepareCustomerPossibilityIssuanceTrust,confirm:trust.confirmCustomerPossibilityIssuanceDelivery};let history=0;
 const repository={getCustomerWork:async()=>work,getOwnedBusinessIds:async()=>[],getCustomerPrivacyControls:async()=>({usePreferencesAsGuidance:false,useFeedbackAsGuidance:false}),saveCustomerIntention:async()=>{history++;return {intentionId:'recorded-intention'};},recordCustomerPossibilityIssuance:async(_,p)=>p.map(x=>x.workItemId)};
 persistence.getRepository=()=>repository;auth.resolveTrustedCustomerIdentityFromRequest=async()=>identity;trust.prepareCustomerPossibilityIssuanceTrust=async()=>{};trust.confirmCustomerPossibilityIssuanceDelivery=async(_,ids)=>confirmedIds || ids;
 const path=require.resolve('../api/customer/possibilities');delete require.cache[path];
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 try{
  const handler=require(path).createPossibilitiesHandler({configuration,defer:task=>tasks.push(task)});await handler({method:'POST',body:{understanding:confirmCustomerUnderstanding(buildCustomerUnderstanding('',query))},headers:{},query:{},...reqExtra},res);await Promise.all(tasks);
 }finally{persistence.getRepository=original.repository;auth.resolveTrustedCustomerIdentityFromRequest=original.identity;trust.prepareCustomerPossibilityIssuanceTrust=original.prepare;trust.confirmCustomerPossibilityIssuanceDelivery=original.confirm;delete require.cache[path];}
 return {...res,history};
}
test('HTTP path uses shared catalogue, hard budget and no model metadata in customer response',async()=>{
 const r=await post({query:'black jacket under £100',work:[item('expensive','£160'),item('cheap')]});assert.equal(r.code,200);assert.deepEqual(r.body.possibilities.map(p=>p.workItemId),['cheap']);assert.doesNotMatch(JSON.stringify(r.body),/intelligenceVersion|shadow|model|dataset|score|requestReference/);assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('ranking receives only trusted issued candidates after authenticated delivery',async()=>{
 let ids;const r=await post({identity:{trustedCustomerIdentityId:'customer-1',identityType:'customer'},confirmedIds:['b'],configuration:{...getCustomerSearchConfiguration(),mode:'shadow',allowProviderRequest:true,provider:{intelligenceVersion:'shadow-v1',rank:async input=>{ids=input.candidates.map(c=>c.workItemId);return {ranked:input.candidates.map(c=>({possibilityId:c.possibilityId,score:1}))};}}}});assert.equal(r.history,1);assert.deepEqual(ids,['b']);assert.deepEqual(r.body.possibilities.map(p=>p.workItemId),['b']);
});
test('controlled test header rules remain authoritative and fictional results do not create history',async()=>{
 const publicEmpty=await post({work:[],reqExtra:{query:{'demeos-test':'1'},headers:{}}});assert.deepEqual(publicEmpty.body,{possibilities:[]});
 const controlled=await post({query:'jacket',work:[],identity:{trustedCustomerIdentityId:'customer-1'},reqExtra:{query:{'demeos-test':'1'},headers:{'x-demeos-test-mode':'controlled-preview'}}});assert.equal(controlled.body.testMode,true);assert.equal(controlled.history,0);assert.ok(controlled.body.possibilities.length);
});
test('customer cannot select mode, provider, artifact or another identity through request fields',async()=>{
 const r=await post({reqExtra:{body:{mode:'candidate',artifact:{approved:true},customerId:'other'}}});assert.equal(r.code,400);
});
test('real repository ownership survives internal catalogue validation and remains absent from public responses',async()=>{
 const row={campaign_id:'approved-work',business_id:'approved-business',campaign:{campaignType:'social',approvalStatus:'Approved',campaignText:'Black waterproof jacket'},profile:{profileVersion:4,name:'Approved',location:'Manchester',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'jacket',businessId:'approved-business',name:'Black jacket',description:'Black waterproof jacket',price:'£89',availability:'available',continuationRoute:'website'}]}};
 const repository=persistence.createPersistenceRepository({ensureSchema:async()=>{},query:async()=>({rows:[row]})});
 const publicProjection=await repository.getCustomerWork();assert.equal(publicProjection[0].businessId,undefined);
 const internal=await repository.getCustomerWork({forCatalogueValidation:true});assert.equal(internal[0].businessId,'approved-business');
 const final=require('../api/_lib/customer-public-work-contract').getValidPublicCustomerWork(internal);assert.equal(final[0].products[0].productId,'jacket');assert.doesNotMatch(JSON.stringify(final),/businessId|approved-business/);
 const r=await post({query:'waterproof black jacket under £100',work:internal});assert.equal(r.body.possibilities[0].products[0].productId,'jacket');assert.doesNotMatch(JSON.stringify(r.body),/businessId|approved-business/);
});
