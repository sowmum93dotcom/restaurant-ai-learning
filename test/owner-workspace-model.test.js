const test = require('node:test'), assert = require('node:assert/strict');
const {resolve, canOpen} = require('../js/owner-workspace-model');
function record(marketing, selling, intent = 'both') {return {businessProfile:{businessId:'owned',preparationModel:intent},workspaceReadiness:{businessId:'owned',marketing:{canPrepare:marketing},selling:{canPrepare:selling,canSell:false}}};}
test('saved intent and remembered view are clamped to exact server preparation permissions',()=>{
  for(const intent of ['marketing','selling','both']) for(const preference of ['marketing','selling','other']) {
    const marketing=resolve(record(true,false,intent),'owned',preference);
    assert.equal(marketing.model,'marketing');assert.deepEqual(marketing.allowed,['marketing']);
    const selling=resolve(record(false,true,intent),'owned',preference);
    assert.equal(selling.model,'selling');assert.deepEqual(selling.allowed,['selling']);
    assert.equal(canOpen(selling,'create'),false);assert.equal(canOpen(selling,'results-view'),false);
    assert.equal(canOpen(selling,'products'),true);
  }
  assert.equal(resolve(record(true,true,'selling'),'owned').model,'selling');
  assert.equal(resolve(record(true,true,'selling'),'owned','marketing').model,'marketing');
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
test('setup, pending, denied, service failure and foreign readiness remain distinct and closed',()=>{
  const pending=record(undefined,undefined);pending.workspaceReadiness.onboarding={status:'submitted'};
  const cases=[[null,null,null,'setup'],[pending,'owned',null,'pending'],[record(false,false),'owned',null,'denied'],[record(true,true),'foreign',null,'unavailable'],[record('true',1),'owned',null,'unavailable'],[record(true,true),'owned','forbidden','forbidden'],[record(true,true),'owned','unavailable','unavailable']];
  for(const [r,id,failure,status] of cases){const state=resolve(r,id,'selling',failure);assert.equal(state.status,status);assert.equal(state.model,null);assert.equal(canOpen(state,'create'),false);assert.equal(canOpen(state,'products'),false);assert.equal(canOpen(state,'business-profile'),true);}
});
