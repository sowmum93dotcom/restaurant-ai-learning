'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {copy}=require('../js/vendor-inventory-copy');
function setup(){
 const elements=new Map(),events={},buttons={},nodes=[];
 function element(){return {hidden:false,disabled:false,textContent:'',dataset:{},attrs:{},children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this[k]=fn;}};}
 for(const id of ['vendor-orders-list','vendor-orders-status','vendor-orders-reload','owner-authenticated-workspace','owner-preparation-language'])elements.set(id,element());
 elements.get('owner-preparation-language').value='en';
 const doc={getElementById:id=>elements.get(id),createElement(){const n=element();nodes.push(n);return n;},querySelectorAll(){return [];},addEventListener(k,fn){events[k]=fn;}};
 let state={status:'ready',model:'selling',businessId:'owner-a'},answer=async()=>({ok:true,json:async()=>({businessId:state.businessId,orders:[]})}),lastRequest;
 const root={document:doc,location:{hash:''},DEMEOSVendorCopy:copy,DEMEOSOwnerWorkspace:{getState:()=>state},addEventListener(k,fn){buttons[k]=fn;},fetch(...args){lastRequest=args;return answer(...args);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/vendor-orders'),'utf8'),{window:root,MutationObserver:class{observe(){}},Intl});
 return {elements,root,events,setState:s=>state=s,setAnswer:a=>answer=a,lastRequest:()=>lastRequest,load:()=>elements.get('vendor-orders-reload').click()};
}
test('private orders distinguish authentication, permission, approval, service failure and empty success in all languages',async()=>{
 const ui=setup();
 for(const [code,translations] of Object.entries(copy)){
  ui.elements.get('owner-preparation-language').value=code;
  for(const [status,body,key] of [[401,{},'ordersAuth'],[403,{},'ordersDenied'],[403,{reason:'application-access-required',applicationStatus:'submitted'},'ordersPending'],[403,{reason:'application-access-required',applicationStatus:'revoked'},'ordersDenied'],[503,{},'ordersError']]){
   ui.setAnswer(async()=>({ok:false,status,json:async()=>body}));await ui.load();
   assert.equal(ui.elements.get('vendor-orders-status').textContent,translations[key]);
   assert.equal(ui.elements.get('vendor-orders-list').children.length,0);
   assert.equal(ui.elements.get('vendor-orders-list').attrs['aria-busy'],'false');
  }
  ui.setAnswer(async()=>({ok:true,json:async()=>({businessId:'owner-a',orders:[]})}));await ui.load();
  assert.equal(ui.elements.get('vendor-orders-list').children[0].textContent,translations.ordersEmpty);
 }
 assert.equal(ui.lastRequest()[0],'/api/businesses/owner-a/orders');assert.equal(ui.lastRequest()[1].credentials,'same-origin');
});
test('orders loading removes previous records and rejects another business response',async()=>{
 const ui=setup();let finish;
 ui.setAnswer(()=>new Promise(resolve=>finish=resolve));const pending=ui.load();
 assert.equal(ui.elements.get('vendor-orders-list').attrs['aria-busy'],'true');assert.equal(ui.elements.get('vendor-orders-reload').disabled,true);
 finish({ok:true,json:async()=>({businessId:'foreign',orders:[{private:'another business'}]})});await pending;
 assert.equal(ui.elements.get('vendor-orders-status').textContent,copy.en.ordersError);assert.equal(ui.elements.get('vendor-orders-list').children.length,0);
});
test('delayed order denial cannot overwrite newly selected business or navigate away',async()=>{
 const ui=setup();let finish;
 ui.root.location.hash='#orders';ui.setAnswer(()=>new Promise(resolve=>finish=resolve));const pending=ui.load();
 ui.root.location.hash='';ui.setState({status:'ready',model:'selling',businessId:'owner-b'});ui.events['owner-model-ready']();
 ui.setAnswer(async()=>({ok:true,json:async()=>({businessId:'owner-b',orders:[]})}));await ui.load();
 finish({ok:false,status:403,json:async()=>({reason:'application-access-required',applicationStatus:'revoked'})});await pending;
 assert.equal(ui.elements.get('vendor-orders-status').textContent,'');assert.equal(ui.elements.get('vendor-orders-list').dataset.state,'empty');assert.equal(ui.lastRequest()[0],'/api/businesses/owner-b/orders');assert.equal(ui.root.location.hash,'');
});
