'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {vendorTestEntry,URL}=require('../api/_lib/vendor-test-entry');
test('test dashboard entry is explicit in Production and points only to the isolated Preview',()=>{
 assert.equal(vendorTestEntry({VERCEL_ENV:'production'}),null);
 assert.equal(vendorTestEntry({VERCEL_ENV:'production',DEMEOS_VENDOR_TEST_DASHBOARD:'true'}),URL);
 assert.equal(vendorTestEntry({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'business-approval-application-access-705'}),URL);
 assert.equal(vendorTestEntry({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'other'}),null);
 assert.equal(vendorTestEntry({DEMEOS_VENDOR_TEST_DASHBOARD:'TRUE',DEMEOS_VENDOR_TEST_DASHBOARD_URL:'https://untrusted.example'}),null);
});
test('all nine languages expose the test dashboard without granting real application access',()=>{
 for(const language of ['en','es','fr','ar','pt','zh','hi','de','ja']){
  const nodes=[],container={replaceChildren(){nodes.length=0;},appendChild(node){nodes.push(node);}};
  const doc={body:{dataset:{sellingEntry:'true'}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(id){return id==='owner-operating-models'?container:null;},createElement(tag){return{tag,dataset:{},addEventListener(){}};},dispatchEvent(){},addEventListener(){}};
  const root={document:doc,location:{pathname:'/selling-vendor/manage',hash:'#media',replace(){throw Error('No automatic navigation');}},DEMEOSVendorTestDashboardUrl:URL,DEMEOSVendorCopy:require('../js/vendor-inventory-copy').copy,CustomEvent:class{},localStorage:{getItem(){return language;}},sessionStorage:{getItem(){}},addEventListener(){},setInterval(){}};
  const context={window:root};vm.runInNewContext(fs.readFileSync(require.resolve('../js/selling-access-copy'),'utf8'),context);vm.runInNewContext(fs.readFileSync(require.resolve('../js/owner-workspace-model'),'utf8'),context);
  const state=root.DEMEOSOwnerWorkspace.apply(doc,null,'owned','denied');assert.equal(state.model,null);assert.equal(root.DEMEOSOwnerWorkspace.canOpen(state,'media'),false);
  const action=nodes.find(node=>node.className==='selling-test-dashboard-entry');assert.equal(action.href,URL);assert.equal(action.textContent,root.DEMEOSVendorTestEntryCopy[language][0]);assert.ok(nodes.some(node=>node.textContent===root.DEMEOSVendorTestEntryCopy[language][1]));
 }
});
test('sample My Business edits save privately while preserving products and never submitting or granting access',()=>{
 const inspection=require('../api/_lib/vendor-inspection'),state=inspection.fixture('https://preview.example');const products=structuredClone(state.profile.products);
 const profile={...state.profile,name:'Sample shop edited',customerContinuation:{routes:[]},informationStatus:{source:'business-owner',status:'business-provided',ownerConfirmedAt:'2026-10-14T00:00:00Z'}};
 inspection.operate(state,'/api/businesses/test-vendor-inspection-705','PUT',{businessProfile:profile,ownerAccuracyConfirmed:true});assert.equal(state.profile.name,'Sample shop edited');assert.deepEqual(state.profile.products,products);assert.equal(state.profile.informationStatus.reviewState,'draft');assert.equal(state.profile.informationStatus.source,'controlled-development-inspection');
 assert.equal(state.profile.applicationAccess,undefined);assert.equal(inspection.record(state).workspaceReadiness.selling.canSell,false);
 assert.throws(()=>inspection.operate(state,'/api/businesses/test-vendor-inspection-705','PUT',{businessProfile:{...profile,businessId:'real-business'}}));
 assert.throws(()=>inspection.operate(state,'/api/businesses/test-vendor-inspection-705','PUT',{businessProfile:{...profile,applicationAccess:{selling:true}}}));
 assert.throws(()=>inspection.operate(state,'/api/businesses/test-vendor-inspection-705','PUT',{action:'submit-business'}));
});
