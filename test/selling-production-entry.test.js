'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Production Selling routes use approved dedicated entries without inspection bootstrap',()=>{
 const routes=require('../vercel.json').rewrites;
 for(const [route,file] of [['/selling-vendor','selling-vendor.html'],['/selling-vendor/manage','selling-vendor-manage.html'],['/selling-vendor/onboarding','selling-vendor-manage.html']]){
  assert.equal(routes.find(r=>r.source===route).destination,'/'+file);
  const html=fs.readFileSync(require.resolve('../'+file),'utf8');
  assert.match(html,/Selling Vendor Application/);assert.match(html,/css\/selling-vendor.css/);
  assert.doesNotMatch(html,/src="\/js\/vendor-inspection.js"|DEMEOS_VENDOR_INSPECTION|href="(?:\/)?business-workspace.html"|href="marketing.html/);
  for(const section of ['overview','business-profile','products','media','product-options','inventory','orders'])assert.match(html,new RegExp('data-owner-section="'+section+'"'));
 }
 assert.equal(routes.find(r=>r.source==='/marketing-business').destination,'/business-workspace.html');
});
test('Selling denied state preserves its presentation without granting access or legacy navigation',()=>{
 const nodes=[];const container={replaceChildren(){nodes.length=0;},appendChild(node){nodes.push(node);}};
 const doc={body:{dataset:{sellingEntry:"true"}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(id){return id==='owner-operating-models'?container:null;},createElement(tag){return {tag,appendChild(){},addEventListener(){}};},dispatchEvent(){},addEventListener(){}};
 const root={document:doc,location:{pathname:'/selling-vendor',hash:'',replace(){throw Error('Unexpected navigation');}},CustomEvent:class{},localStorage:{getItem(){}},sessionStorage:{getItem(){}},addEventListener(){},setInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/owner-workspace-model'),'utf8'),{window:root});
 const api=root.DEMEOSOwnerWorkspace;
 const state=api.apply(doc,null,'owned','denied');assert.equal(state.model,null);assert.equal(api.canOpen(state,'products'),false);assert.equal(doc.body.dataset.ownerModel,'selling');
 assert.equal(nodes.find(n=>n.tag==='a').href,'/selling-vendor/onboarding#business-profile');
 assert.equal(api.recordQuery(),'?application=selling');root.location.pathname='/selling-vendor/onboarding';assert.equal(api.recordQuery(),'');root.location.pathname='/marketing-business/manage';assert.equal(api.recordQuery(),'?application=marketing');
});

test('verified Selling owner old bookmarks route to dedicated onboarding without granting access',()=>{
 let destination;const doc={body:{dataset:{}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(){return null;},dispatchEvent(){},addEventListener(){}};
 const root={document:doc,location:{pathname:'/business-workspace.html',replace(url){destination=url;}},CustomEvent:class{},localStorage:{getItem(){}},sessionStorage:{getItem(){}},addEventListener(){},setInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/owner-workspace-model'),'utf8'),{window:root});
 const record={businessProfile:{businessId:'owned',preparationModel:'selling'},workspaceReadiness:{businessId:'owned',selling:{canPrepare:false},marketing:{canPrepare:false}}};
 const state=root.DEMEOSOwnerWorkspace.apply(doc,record,'owned');assert.equal(destination,'/selling-vendor/onboarding#business-profile');assert.equal(state.status,'denied');assert.equal(root.DEMEOSOwnerWorkspace.canOpen(state,'products'),false);
 destination=undefined;root.DEMEOSOwnerWorkspace.apply(doc,record,'foreign');assert.equal(destination,undefined);
});

test('all seven Selling sections and denied authority survive a language change',()=>{
 const nav={children:[],replaceChildren(){this.children=[];},appendChild(n){this.children.push(n);},style:{setProperty(){}}};
 let change;const select={value:'en',dataset:{},addEventListener(event,callback){if(event==='change')change=callback;}};
 const doc={body:{dataset:{sellingEntry:'true'}},querySelector(selector){return selector==='.owner-workspace-navigation'?nav:null;},querySelectorAll(){return [];},getElementById(id){return id==='owner-preparation-language'?select:null;},createElement(){return {dataset:{},addEventListener(){}};},dispatchEvent(){},addEventListener(){}};
 let language='en';const root={document:doc,location:{pathname:'/selling-vendor/manage',hash:'#products'},CustomEvent:class{},DEMEOSVendorCopy:require('../js/vendor-inventory-copy').copy,localStorage:{getItem(){return language;},setItem(_key,value){language=value;}},sessionStorage:{getItem(){}},addEventListener(){},setInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/owner-workspace-model'),'utf8'),{window:root});
 const api=root.DEMEOSOwnerWorkspace;api.apply(doc,{businessProfile:{businessId:'owned'},workspaceReadiness:null},'owned','denied');
 assert.equal(nav.children.length,7);assert.deepEqual(nav.children.map(n=>n.dataset.ownerSection),['overview','business-profile','products','media','product-options','inventory','orders']);
 select.value='fr';change();assert.equal(api.getState(doc).status,'denied');assert.equal(api.canOpen(api.getState(doc),'products'),false);assert.equal(nav.children.length,7);assert.equal(nav.children[2].textContent,root.DEMEOSVendorCopy.fr.applicationCatalogue);assert.equal(root.location.hash,'#products');
});
