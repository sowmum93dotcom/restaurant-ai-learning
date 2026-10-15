const test = require('node:test'), assert = require('node:assert/strict');
const {resolve, canOpen} = require('../js/owner-workspace-model');
function record(marketing, selling, intent = 'both') {return {businessProfile:{businessId:'owned',preparationModel:intent},workspaceReadiness:{businessId:'owned',marketing:{canPrepare:marketing},selling:{canPrepare:selling,canSell:false}}};}
test('application routes never fall back into another authorised application',()=>{
 for(const intent of ['marketing','selling','both']) {
   const marketing=resolve(record(true,false,intent),'owned','marketing');
   const selling=resolve(record(false,true,intent),'owned','selling');
   assert.equal(marketing.model,'marketing');assert.equal(selling.model,'selling');
   assert.equal(resolve(record(true,false,intent),'owned','selling').status,'denied');
   assert.equal(resolve(record(false,true,intent),'owned','marketing').status,'denied');
   assert.equal(canOpen(selling,'create'),false);assert.equal(canOpen(selling,'results-view'),false);
   assert.equal(canOpen(selling,'products'),true);
 }
 assert.equal(resolve(record(true,true,'selling'),'owned').model,'marketing');
 assert.equal(resolve(record(true,true,'selling'),'owned','selling').model,'selling');
});
test('invalidated detail responses cannot overwrite profiles, pending edits or campaigns',async()=>{
  const {hydrateKnownBusiness}=require('../js/script');
  const data=new Map([['demeosBusinessProfiles',JSON.stringify([{businessId:'owned',name:'Latest edit'}])],['demeosCampaignHistory','[]'],['demeosPendingBusinessProfileSync','["owned"]']]);
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  let accept=true,finish;
  const before=JSON.stringify([...data]);
  const request=hydrateKnownBusiness(storage,'owned',()=>new Promise(r=>finish=r),()=>accept);
  accept=false;
  finish({ok:true,json:async()=>({businessProfile:{businessId:'owned',name:'Older server record'},campaigns:[{id:'old',businessId:'owned'}]})});
  assert.equal((await request).reason,'stale-response');assert.equal(JSON.stringify([...data]),before);
  const forbidden=await hydrateKnownBusiness(storage,'owned',async()=>({ok:false,status:403}));
  assert.equal(forbidden.reason,'forbidden');assert.equal(JSON.stringify([...data]),before);
});
test('Selling hydration evicts active business Marketing cache without losing shared identity or another business cache',()=>{
  const {mergeKnownBusinessPersistence}=require('../js/script');
  const profiles=[{businessId:'owned',name:'Same business',products:[{productId:'exact-product'}]}];
  const campaigns=[{id:'cached-private-draft',businessId:'owned'},{id:'other-private-draft',businessId:'other'}];
  const server={businessProfile:profiles[0],campaigns:[]};
  const selling=mergeKnownBusinessPersistence(profiles,campaigns,'owned',server,false,[],'selling');
  assert.deepEqual(selling.campaigns,[campaigns[1]]);assert.deepEqual(selling.profiles,profiles);
  assert.deepEqual(mergeKnownBusinessPersistence(profiles,campaigns,'owned',server,false,[],'marketing').campaigns,campaigns);
});
test('setup, pending, denied, service failure and foreign readiness remain distinct and closed',()=>{
  const pending=record(undefined,undefined);pending.workspaceReadiness.onboarding={status:'submitted'};
  const cases=[[null,null,null,'setup'],[pending,'owned',null,'pending'],[record(false,false),'owned',null,'denied'],[record(true,true),'foreign',null,'unavailable'],[record('true',1),'owned',null,'unavailable'],[record(true,true),'owned','forbidden','forbidden'],[record(true,true),'owned','unavailable','unavailable']];
  for(const [r,id,failure,status] of cases){const state=resolve(r,id,'selling',failure);assert.equal(state.status,status);assert.equal(state.model,null);assert.equal(canOpen(state,'create'),false);assert.equal(canOpen(state,'products'),false);assert.equal(canOpen(state,'business-profile'),true);}
});

test('open-tab revalidation stays application-scoped and discards delayed denials after a business switch',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let focus,finishDenial,parsed,url;
 const parsing=new Promise(resolve=>parsed=resolve);
 const doc={hidden:false,body:{dataset:{}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(id){return id==='owner-authenticated-workspace'?{hidden:false}:null;},addEventListener(){},dispatchEvent(){}};
 const root={document:doc,location:{pathname:'/marketing-business/manage',hash:'#media'},localStorage:{getItem(){return null;}},sessionStorage:{getItem(){return null;}},CustomEvent:class{},addEventListener(event,fn){if(event==='focus')focus=fn;},setInterval(){},async fetch(path){url=path;return {ok:false,status:403,json(){parsed();return new Promise(resolve=>finishDenial=resolve);}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/owner-workspace-model'),'utf8'),{window:root});
 const first=record(true,false),other=record(true,false);other.businessProfile.businessId='other';other.workspaceReadiness.businessId='other';
 root.DEMEOSOwnerWorkspace.apply(doc,first,'owned');const pending=focus();await parsing;
 assert.equal(url,'/api/businesses/owned?application=marketing');
 root.DEMEOSOwnerWorkspace.apply(doc,other,'other');finishDenial({reason:'application-access-required',applicationStatus:'revoked'});await pending;
 assert.equal(root.DEMEOSOwnerWorkspace.getState(doc).businessId,'other');assert.equal(root.DEMEOSOwnerWorkspace.getState(doc).status,'ready');
});
