const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const codes=['en','es','fr','ar','pt','zh','hi','de','ja'];
test('registration provider copy covers all nine languages and combined account entry without English heading fallback',()=>{
 for(const code of codes){
  const locale=require('../js/customer-auth-locales/'+code+'.json');
  assert.ok(locale.locale.startsWith(code));
  for(const key of ['formButtonPrimary','formFieldLabel__emailAddress','formFieldLabel__password','socialButtonsBlockButton','dividerText'])assert.ok(locale[key]);
  for(const section of ['signIn','signUp'])for(const key of ['title','titleCombined','subtitle','subtitleCombined'])assert.ok(locale[section].start[key],code+' '+section+' '+key);
  if(code!=='en')assert.notEqual(locale.signIn.start.titleCombined,require('../js/customer-auth-locales/en.json').signIn.start.titleCombined);
 }
});
function environment(){
 const callbacks=[],requests=[],updates=[];let reloads=0;
 const root={document:{documentElement:{lang:'ja'}},fetch:async(url)=>{requests.push(url);return {ok:true,json:async()=>require('../'+url.slice(1))};},MutationObserver:class{constructor(callback){callbacks.push(callback);}observe(){}},location:{reload(){reloads++;}}};
 vm.runInNewContext(fs.readFileSync('js/customer-auth-language.js','utf8'),{window:root,Map,Error,Object});
 return {root,callbacks,requests,updates,get reloads(){return reloads;}};
}
test('existing language selection loads only its provider resource and updates the same mounted provider',async()=>{
 const e=environment(),adapter=e.root.DEMEOSCustomerAuthLanguage;
 assert.equal((await adapter.localization()).locale,'ja-JP');
 assert.deepEqual(e.requests,['/js/customer-auth-locales/ja.json']);
 adapter.bind({__internal_updateProps:async value=>e.updates.push(value)});
 e.root.document.documentElement.lang='ar';await e.callbacks[0]();
 assert.equal(e.updates[0].options.localization.locale,'ar-SA');assert.equal(e.reloads,0);
 await adapter.localization('ja');assert.equal(e.requests.length,2,'cached current-language resource is reused');
});
test('an unsupported provider update hook reloads the existing page rather than leaving mixed language copy',async()=>{
 const e=environment();e.root.DEMEOSCustomerAuthLanguage.bind({});
 e.root.document.documentElement.lang='fr';await e.callbacks[0]();assert.equal(e.reloads,1);
});
