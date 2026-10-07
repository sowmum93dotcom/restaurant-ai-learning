const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/customer-controlled-navigation'),'utf8');
const key='demeos-customer-content-context-v1';
function page(path,storage=new Map(),hrefs=[]){
 const events={};const links=hrefs.map(href=>({href,getAttribute(){return this.href;},setAttribute(_,value){this.href=value;}}));
 const root={addEventListener:(n,fn)=>events[n]=fn,location:{href:'https://www.demeos.io'+path},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  history:{state:{preserved:true},replaceState(state,_,url){this.state=state;root.location.href=new URL(url,root.location.href).href;}},
  document:{addEventListener:(n,fn)=>events[n]=fn,querySelectorAll:()=>links}};
 vm.runInNewContext(source,{window:root,URL});events.DOMContentLoaded();return {root,links,storage,events};
}
test('every homepage and account link keeps one canonical customer address',()=>{
 for(const path of ['/index.html','/customer.html','/my-demeos.html','/privacy.html','/terms.html','/contact.html']){
  const p=page(path,undefined,['customer.html#discover','my-demeos.html']);
  assert.deepEqual(p.links.map(l=>l.href),['customer.html#discover','my-demeos.html']);
 }
});
test('old preview and public bookmarks converge without losing selection or history',()=>{
 for(const flag of ['1','0','true']){
  const storage=new Map([[key,'controlled'],['demeos-controlled-preparation-v1','selected options']]);
  const p=page('/customer.html?demeos-test='+flag+'&work=w&product=p&resume=1#product-experience',storage);
  const url=new URL(p.root.location.href);
  assert.equal(url.searchParams.has('demeos-test'),false);
  assert.equal(url.searchParams.get('work'),'w');assert.equal(url.searchParams.get('product'),'p');
  assert.equal(url.searchParams.get('resume'),'1');assert.equal(url.hash,'#product-experience');
  assert.deepEqual(p.root.history.state,{preserved:true});assert.equal(storage.has(key),false);
  assert.equal(storage.get('demeos-controlled-preparation-v1'),'selected options');
 }
});
test('old customer links normalize but unrelated destinations stay intact',()=>{
 const unrelated=['https://vendor.example/customer.html?demeos-test=1','business-workspace.html?demeos-test=1','admin.html?demeos-test=1','#discover','mailto:support@example.com'];
 const p=page('/customer.html',undefined,['my-demeos.html?demeos-test=1&prepare=1#privacy-control',...unrelated]);
 assert.equal(p.links[0].href,'/my-demeos.html?prepare=1#privacy-control');
 assert.deepEqual(p.links.slice(1).map(l=>l.href),unrelated);
});
test('cached and dynamic links normalize on restore and click',()=>{
 const p=page('/customer.html',undefined,['customer.html']);const link=p.links[0];
 link.href='customer.html?demeos-test=0#discover';p.events.pageshow();assert.equal(link.href,'/customer.html#discover');
 link.href='my-demeos.html?prepare=1&demeos-test=1';p.events.click({target:{closest:()=>link}});
 assert.equal(link.href,'/my-demeos.html?prepare=1');
});
test('blocked session storage does not prevent canonical navigation',()=>{
 const events={},link={href:'customer.html?demeos-test=1#discover',getAttribute(){return this.href;},setAttribute(_,v){this.href=v;}};
 const root={location:{href:'https://www.demeos.io/index.html'},get sessionStorage(){throw Error('blocked');},document:{addEventListener:(n,f)=>events[n]=f,querySelectorAll:()=>[link]}};
 vm.runInNewContext(source,{window:root,URL});events.DOMContentLoaded();assert.equal(link.href,'/customer.html#discover');
});
