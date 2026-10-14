'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {collectBusinessProfileFields,updateBusinessProfile}=require('../js/script');
const fields={name:{value:' Updated shop '},type:{value:'Clothing'},location:{value:'London'},productsServices:{value:'Jackets'},brandVoice:null,targetCustomer:null,goal:null};
test('Selling profile edits preserve an existing business Marketing context without exposing editors',()=>{
 const existing={businessId:'existing-both',preparationModel:'both',brandVoice:'Professional',targetCustomer:'Local customers',goal:'Brand awareness'};
 const collected=collectBusinessProfileFields(fields,existing,true);
 const updated=updateBusinessProfile([existing],{...collected,preparationModel:existing.preparationModel},existing.businessId).profile;
 assert.equal(updated.name,'Updated shop');assert.equal(updated.preparationModel,'both');
 for(const key of ['brandVoice','targetCustomer','goal'])assert.equal(updated[key],existing[key]);
 assert.equal(existing.name,undefined);
});
test('new Selling setup does not invent Marketing information or require absent Marketing controls',()=>{
 const collected=collectBusinessProfileFields(fields,null,true);
 assert.deepEqual(collected,{name:'Updated shop',type:'Clothing',location:'London',productsServices:'Jackets'});
});
test('Marketing setup still reads its own editable information',()=>{
 const collected=collectBusinessProfileFields({...fields,brandVoice:{value:' New voice '},targetCustomer:{value:' New customers '},goal:{value:' New goal '}},{brandVoice:'Old'},false);
 assert.equal(collected.brandVoice,'New voice');assert.equal(collected.targetCustomer,'New customers');assert.equal(collected.goal,'New goal');
});
test('Selling setup has no Marketing selector or context fields while Marketing retains them',()=>{
 const selling=fs.readFileSync('selling-vendor-manage.html','utf8'),marketing=fs.readFileSync('marketing.html','utf8');
 for(const id of ['onboarding-marketing','business-profile-marketing','business-brand-voice','business-target-customer','business-goal']){
  assert.ok(!selling.includes('id="'+id+'"'));assert.ok(marketing.includes('id="'+id+'"'));
 }
 assert.match(selling,/<input type="hidden" id="business-preparation-model" value="selling"/);
 assert.doesNotMatch(selling,/<select id="business-preparation-model"/);
 assert.match(marketing,/<select id="business-preparation-model"/);
});
