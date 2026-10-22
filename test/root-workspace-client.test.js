'use strict';
// Minimal DOM exercises request races in the shipped client. No layout,
// real authentication, inference or deployed acceptance is implied.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const copy=require('../js/root-ai-copy');
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
async function client(){
 class Element{
  constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.children=[];this.listeners={};this.textContent='';this.dataset={};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
  async fire(name){return this.listeners[name]?.({preventDefault(){}});}
 }
 const nodes=Object.fromEntries([...fs.readFileSync('root-ai.html','utf8').matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
 const historyCopy=new Element(),calls=[];
 const document={getElementById:id=>nodes[id],createElement:()=>new Element(),documentElement:{},querySelectorAll:()=>[],querySelector:()=>historyCopy};
 const session={id:'session',getToken:async()=>'fixture-token'};
 const window={DEMEOSRootCopy:copy,DEMEOSSellingCopy:{languages:[{code:'en',name:'English'}],resolve:()=>({code:'en',direction:'ltr'}),translate:(_locale,text)=>text},CustomerUnderstanding:{buildCustomerUnderstanding:(_old,text)=>text?{understanding:text}:null},__internal_ClerkUICtor:{},Clerk:{user:{id:'alice'},session,load:async()=>{},addListener(){}}};
 let preflightSignal;
 const context={registry:{categories:[]},runtime:{controlledSellingVisual:true},history:{status:'unavailable'}};
 const fetch=async(url,options={})=>{
  if(url==='/api/public-config')return {ok:true,json:async()=>({clerkPublishableKey:'pk_test_'+Buffer.from('fixture.example$').toString('base64')})};
  if(url.includes('locales'))return {ok:true,json:async()=>({})};
  const body=options.body?JSON.parse(options.body):null;calls.push(body);
  if(body?.action==='prepare-controlled-runtime'){
   preflightSignal=options.signal;
   return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));
  }
  return {ok:true,json:async()=>body?.action==='selling-options'?{products:[{businessId:'fixture',productId:'p',revision:'r',name:'Fixture',businessName:'Fixture'}]}:context};
 };
 vm.runInNewContext(fs.readFileSync('js/root-ai.js','utf8'),{window,document,fetch,localStorage:{getItem(){},setItem(){}},location:{origin:'https://preview.example',search:''},URLSearchParams,atob:value=>Buffer.from(value,'base64').toString(),AbortController,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto});
 await tick();assert.equal(nodes.workspace.hidden,false);
 return {nodes,window,calls,get preflightSignal(){return preflightSignal;}};
}
test('ROOT drops a delayed old token before sending a request in a different context',async()=>{
 const {nodes,window,calls}=await client();let release;
 const original=window.Clerk.session.getToken;
 window.Clerk.session.getToken=()=>new Promise(resolve=>{release=resolve;});
 nodes.text.value='old business request';const pending=nodes.understanding.fire('submit');await tick();
 assert.equal(typeof release,'function');window.Clerk.session.getToken=original;
 await nodes.customer.fire('click');await tick();release('fixture-token');await pending;
 assert.equal(calls.filter(body=>body?.text==='old business request').length,0);
 assert.equal(nodes.result.hidden,true);assert.equal(nodes.run.disabled,false);
});
test('ROOT aborts obsolete preflight and restores GPU controls and consent on context change',async()=>{
 const app=await client(),{nodes}=app;
 nodes['share-consent'].checked=true;await nodes['load-selling'].fire('click');
 nodes['visual-consent'].checked=true;const pending=nodes['runtime-preflight'].fire('click');await tick();
 assert.equal(nodes['runtime-preflight'].disabled,true);
 await nodes.customer.fire('click');await tick();await pending;
 assert.equal(app.preflightSignal.aborted,true);assert.equal(nodes['runtime-preflight'].disabled,false);
 assert.equal(nodes['visual-run'].disabled,false);assert.equal(nodes['visual-consent'].checked,false);
 assert.equal(nodes['preflight-status'].textContent,'');assert.equal(nodes.integration.hidden,true);
});
