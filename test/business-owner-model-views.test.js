const test = require('node:test');
const assert = require('node:assert/strict');
const {getOwnerModelViews, getTrustedOwnerNextAction, loadOwnerNextAction} = require('../js/business-workspace');
const {workspaceReadiness} = require('../api/_lib/business-workspace-readiness');
const {getOwnerActivityMetrics} = require('../js/business-results');
const businessId = 'owned';
const ready = values => ({businessId, ...values});
test('workflow views require exact server readiness and strict preparation booleans', () => {
 assert.deepEqual(getOwnerModelViews(null,businessId), []);
 assert.deepEqual(getOwnerModelViews(ready({marketing:{canPrepare:true}}),'foreign'), []);
 assert.deepEqual(getOwnerModelViews(ready({marketing:{canPrepare:'true'},selling:{canPrepare:1,canSell:true}}),businessId), []);
 const marketing=getOwnerModelViews(ready({marketing:{canPrepare:true},selling:{canPrepare:false}}),businessId);
 assert.deepEqual(marketing.map(v=>v.id), ['marketing']); assert.match(marketing[0].status,/£149 per month/);
 const selling=getOwnerModelViews(ready({marketing:{canPrepare:false},selling:{canPrepare:true,canSell:true}}),businessId);
 assert.deepEqual(selling.map(v=>v.id), ['selling']); assert.equal(selling[0].destination,'marketing.html#products');
 assert.match(selling[0].description,/server checks/);
 const both=getOwnerModelViews(ready({marketing:{canPrepare:true},selling:{canPrepare:true,canSell:false}}),businessId);
 assert.deepEqual(both.map(v=>v.id), ['marketing','selling']); assert.match(both[1].status,/Selling is not enabled/);
 assert.match(getOwnerModelViews(ready({selling:{canPrepare:true}}),businessId)[0].status,/could not be confirmed/);
});
test('browser and profile model choices cannot enable the existing server purchase permission',()=>{
 const record={businessProfile:{businessId,sellerStatus:'verified',workspaceReadiness:{selling:{canSell:true}}}};
 const server=workspaceReadiness(record,businessId);
 const before=JSON.stringify(server); const views=getOwnerModelViews(server,businessId);
 assert.equal(views[1].destination,'marketing.html#products'); assert.equal(JSON.stringify(server),before);
 assert.equal(server.selling.canSell,false);
});
test('a missing activity feed is unavailable, while a recorded empty feed is zero',()=>{
 const record={businessProfile:{businessId},campaigns:[]};
 assert.equal(getOwnerActivityMetrics(record,businessId)[2].value,null);
 assert.equal(getOwnerActivityMetrics({...record,customerParticipationResults:[]},businessId)[2].value,0);
});
test('an owner with no saved offers is directed to product preparation first',()=>{
 assert.equal(getTrustedOwnerNextAction({businessProfile:{businessId,products:[]},campaigns:[]},businessId).destination,'marketing.html#products');
});
test('a late response for a previous business cannot redraw the current workspace',async()=>{
 let active=businessId,resolve; const storage={getItem:()=>active};
 const document={getElementById:()=>{throw Error('Stale data must not render');}};
 const pending=loadOwnerNextAction(document,storage,()=>new Promise(r=>resolve=r));
 active='other'; resolve({ok:true,json:async()=>({businessProfile:{businessId},campaigns:[]})});
 assert.equal((await pending).title,'Next action unavailable');
});

test('the next action follows confirmed preparation access and fails closed without it',()=>{
 const record={businessProfile:{businessId,products:[]},campaigns:[]};
 assert.equal(getTrustedOwnerNextAction({...record,workspaceReadiness:ready({selling:{canPrepare:true,canSell:false}})},businessId).destination,'marketing.html#products');
 assert.equal(getTrustedOwnerNextAction({...record,workspaceReadiness:ready({marketing:{canPrepare:false},selling:{canPrepare:false}})},businessId).title,'Next action unavailable');
});
