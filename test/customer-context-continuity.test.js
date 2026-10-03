const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/customer-controlled-navigation'),'utf8');
const key='demeos-customer-content-context-v1';
function page(path,storage=new Map(),hrefs=[]){
 const events={};const links=hrefs.map(href=>({href,getAttribute(){return this.href;},setAttribute(_,value){this.href=value;}}));
 const root={location:{href:'https://www.demeos.io'+path},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  history:{state:{preserved:true},replaceState(state,_,url){this.state=state;root.location.href=new URL(url,root.location.href).href;}},
  document:{addEventListener:(n,fn)=>events[n]=fn,querySelectorAll:()=>links}};
 vm.runInNewContext(source,{window:root,URL});events.DOMContentLoaded();return {root,links,storage,events};
}
test('fresh public entry never opts into controlled data',()=>{const p=page('/index.html',undefined,['customer.html','my-demeos.html']);assert.deepEqual(p.links.map(l=>l.href),['customer.html','my-demeos.html']);assert.equal(p.storage.size,0);});
test('explicit activation survives homepage, account and information returns in one tab',()=>{
 const storage=new Map();page('/customer.html?demeos-test=1#discover',storage);
 for(const path of ['/index.html','/my-demeos.html','/privacy.html','/terms.html','/contact.html']){
  const p=page(path,storage,['customer.html#discover','my-demeos.html#privacy-control','index.html']);
  for(const link of p.links)assert.equal(new URL(link.href,'https://www.demeos.io').searchParams.get('demeos-test'),'1');
 }
 const p=page('/customer.html?resume=1#product-experience',storage);
 const url=new URL(p.root.location.href);assert.equal(url.searchParams.get('demeos-test'),'1');assert.equal(url.searchParams.get('resume'),'1');assert.equal(url.hash,'#product-experience');assert.deepEqual(p.root.history.state,{preserved:true});
});
test('purchase authentication URL and selection draft stay intact',()=>{
 const storage=new Map([[key,'controlled'],['demeos-controlled-preparation-v1','exact selected options']]);
 const p=page('/my-demeos.html?prepare=1',storage,['customer.html#discover']);assert.equal(p.root.location.href,'https://www.demeos.io/my-demeos.html?prepare=1');assert.equal(storage.get('demeos-controlled-preparation-v1'),'exact selected options');assert.match(p.links[0].href,/demeos-test=1#discover$/);
});
test('explicit exit wins over remembered context and remains normal across navigation',()=>{
 const storage=new Map([[key,'controlled']]);const active=page('/customer.html?demeos-test=1',storage,['customer.html?demeos-test=0#discover']);assert.equal(active.links[0].href,'customer.html?demeos-test=0#discover');
 page('/customer.html?demeos-test=0#discover',storage);assert.equal(storage.has(key),false);
 const home=page('/index.html',storage,['customer.html']);assert.equal(home.links[0].href,'customer.html');
});
test('external, owner, admin and same-screen links never inherit controlled context',()=>{
 const hrefs=['https://vendor.example/customer.html','business-workspace.html','admin.html','#discover','mailto:support@example.com'];const p=page('/customer.html?demeos-test=1',undefined,hrefs);assert.deepEqual(p.links.map(l=>l.href),hrefs);
});
test('unsupported activation is fail closed, and fresh tabs stay public',()=>{
 const storage=new Map([[key,'controlled']]);page('/index.html?demeos-test=true',storage);assert.equal(storage.has(key),false);
 assert.equal(new URL(page('/customer.html#discover').root.location.href).searchParams.has('demeos-test'),false);
});
test('dynamically created customer links preserve context on click',()=>{const p=page('/customer.html?demeos-test=1');const link={href:'my-demeos.html#privacy-control',getAttribute(){return this.href;},setAttribute(_,v){this.href=v;}};p.events.click({target:{closest:()=>link}});assert.equal(link.href,'/my-demeos.html?demeos-test=1#privacy-control');});
test('explicit URL navigation still works when session storage is blocked',()=>{
 const events={},link={href:'customer.html',getAttribute(){return this.href;},setAttribute(_,v){this.href=v;}};
 const root={location:{href:'https://www.demeos.io/index.html?demeos-test=1'},get sessionStorage(){throw Error('blocked');},document:{addEventListener:(n,f)=>events[n]=f,querySelectorAll:()=>[link]}};
 vm.runInNewContext(source,{window:root,URL});events.DOMContentLoaded();assert.equal(link.href,'/customer.html?demeos-test=1');
});
