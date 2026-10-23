'use strict';
// Minimal DOM exercises request races in the shipped client. No layout,
// real authentication, inference or deployed acceptance is implied.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const copy=require('../js/root-ai-copy');
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
async function client(works,settings={}){
 class Element{
  constructor(tagName){this.tagName=tagName;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.children=[];this.listeners={};this.textContent='';this.dataset={};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
  async fire(name){return this.listeners[name]?.({preventDefault(){}});}
 }
 const nodes=Object.fromEntries([...fs.readFileSync('root-ai.html','utf8').matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
 const historyCopy=new Element(),calls=[];
 const document={getElementById:id=>nodes[id],createElement:tag=>new Element(tag),documentElement:{},querySelectorAll:()=>[],querySelector:()=>historyCopy};
 const session={id:'session',getToken:async()=>'fixture-token'};
 const window={DEMEOSRootCopy:copy,DEMEOSSellingCopy:{languages:[{code:'en',name:'English'}],resolve:()=>({code:'en',direction:'ltr'}),translate:(_locale,text)=>text},CustomerUnderstanding:{buildCustomerUnderstanding:(_old,text)=>text?{understanding:text}:null},__internal_ClerkUICtor:{},Clerk:{user:{id:'alice'},session,load:async()=>{},addListener(){}}};
 let preflightSignal;
 const context={registry:{categories:[]},runtime:{controlledSellingVisual:true},history:works?{status:'available',works}:{status:'unavailable'}};
 const fetch=async(url,options={})=>{
  if(url==='/api/public-config')return {ok:true,json:async()=>({clerkPublishableKey:'pk_test_'+Buffer.from('fixture.example$').toString('base64')})};
  if(url.includes('locales'))return {ok:true,json:async()=>({})};
  const body=options.body?JSON.parse(options.body):null;calls.push(body);
  if(body?.action==='review-work'&&settings.conflict){context.history={status:'available',works:settings.latestWorks};return {ok:false,status:409};}
  if(body?.action==='prepare-controlled-runtime'){
   preflightSignal=options.signal;
   return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));
  }
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(body?.action==='selling-options'?{products:[{businessId:'fixture',productId:'p',revision:'r',name:'Fixture',businessName:'Fixture'}]}:context))};
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

test('ROOT reopens native suggestions for review without replacing original evidence or a saved correction',async()=>{
 const result={source:{text:'Original product text'},engine:{modelExecuted:true,modelId:'fixture-only'},visual:{proposals:[{value:'Unverified fixture suggestion'}]},literalCategoryEvidence:[],selectedCategory:null,checklist:[]};
 for(const state of ['pending','accepted','corrected','rejected']){
  const work={work_id:'fixture',result,review_state:state,reviewed_text:state==='corrected'?'Owner correction':null};
  const {nodes,calls}=await client([work]);
  await nodes['work-history'].children[0].children[0].fire('click');
  assert.equal(nodes.text.value,'Original product text');
  assert.equal(nodes['review-text'].value,state==='corrected'?'Owner correction':'Unverified fixture suggestion');
  assert.equal(nodes['work-review-state'].textContent,copy.translate('en',({pending:'reviewPending',accepted:'reviewAccepted',corrected:'reviewCorrected',rejected:'reviewRejected'})[state]));
  assert.equal(nodes['save-work'].disabled,true,'native evidence cannot be re-saved as deterministic text');
  assert.equal(nodes['analysis-save'].hidden,true,'native work is already saved; no second deterministic save is offered');
  nodes['save-consent'].checked=true;await nodes['save-work'].fire('click');
  assert.equal(calls.filter(body=>body?.action==='save-work').length,0,'native output cannot enter the supplied-text save path');
  assert.ok(nodes.evidence.children.some(node=>node.textContent===copy.translate('en','modelEvidence')));
  const diagnostics=nodes.evidence.children.find(node=>node.tagName==='details');
  assert.ok(diagnostics,'category checks have a separate disclosure');
  assert.notEqual(diagnostics.open,true,'native category diagnostics stay closed');
  assert.equal(diagnostics.children[0].textContent,copy.translate('en','categoryDiagnostic'));
  assert.ok(!nodes.evidence.children.some(node=>node.textContent.startsWith(copy.translate('en','matched')+':')),'literal category matching is not presented as model evidence');
 }
});

test('ROOT review conflict preserves the draft and reloads the latest authorised revision before another decision',async()=>{
 const result={source:{text:'Original product text'},engine:{modelExecuted:false},literalCategoryEvidence:[],selectedCategory:null,checklist:[]};
 const work={work_id:'fixture',revision:1,result,review_state:'pending',reviewed_text:null};
 const latest={...work,revision:2,review_state:'corrected',reviewed_text:'Saved in another session'};
 const {nodes,calls}=await client([work],{conflict:true,latestWorks:[latest]});
 await nodes['work-history'].children[0].children[0].fire('click');
 nodes['review-text'].value='My unsaved correction';await nodes['correct-work'].fire('click');
 assert.equal(nodes['review-text'].value,'My unsaved correction');
 assert.equal(nodes['review-status'].textContent,copy.translate('en','reviewConflict'));
 for(const id of ['accept-work','correct-work','reject-work'])assert.equal(nodes[id].disabled,true);
 const attempts=calls.filter(body=>body?.action==='review-work').length;
 await nodes['correct-work'].fire('click');assert.equal(calls.filter(body=>body?.action==='review-work').length,attempts);
 await nodes['work-history'].children[0].children[0].fire('click');
 assert.equal(nodes['review-text'].value,'Saved in another session');
 assert.equal(nodes['correct-work'].disabled,false);
 await nodes['correct-work'].fire('click');assert.equal(calls.filter(body=>body?.action==='review-work').at(-1).revision,2);
});


test('ROOT request entry keeps text diagnostics closed and separates Business tools from Customer search',async()=>{
 const {nodes,calls}=await client();
 assert.equal(nodes['text-diagnostics'].open,false);
 assert.equal(nodes['analysis-save'].hidden,true,'no analysis-save controls without a result');
 assert.equal(nodes['request-hint'].textContent,copy.translate('en','requestBusiness'));
 assert.equal(nodes['media-entry'].hidden,false);
 assert.equal(nodes['customer-search'].hidden,true);
 nodes['text-diagnostics'].open=true;nodes['category-diagnostics'].open=true;
 nodes.text.value='Find a camping tent';await nodes.text.fire('input');
 assert.equal(calls.filter(Boolean).length,0,'typing alone sends no request');
 await nodes.customer.fire('click');await tick();
 assert.equal(nodes.text.value,'','old Business text cannot become Customer consent');
 assert.equal(nodes['text-diagnostics'].open,false);
 assert.equal(nodes['category-diagnostics'].open,false);
 assert.equal(nodes['request-hint'].textContent,copy.translate('en','requestCustomer'));
 assert.equal(nodes['media-entry'].hidden,true);
 assert.equal(nodes['customer-search'].hidden,false);
 assert.equal(nodes.integration.hidden,true);
 assert.equal(nodes['search-consent'].checked,false);
 for(const locale of Object.keys(copy.rows))for(const key of ['requestHeading','requestText','requestBusiness','requestCustomer','textDiagnostics','openMediaTools']){
  assert.equal(typeof copy.translate(locale,key),'string');assert.notEqual(copy.translate(locale,key),key);
 }
});
