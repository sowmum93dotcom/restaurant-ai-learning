(function(){'use strict';
const $=id=>document.getElementById(id),copy=window.DEMEOSRootCopy,shared=window.DEMEOSSellingCopy;
let locale='en',audience='business',clerk=null,context=null,sequence=0,sessionKey='',busy=false,booting=false,sharedProducts=[],selectedWork=null,saveRequestId=null,activeRequest=null;
try{locale=shared.resolve(localStorage.getItem('demeos-customer-language')).code;}catch{}
const t=key=>copy.translate(locale,key);
function syncCustomerSearch(){
 const textEnabled=context?.runtime?.controlledText===true&&context?.history?.status==='available';
 $('text-runtime').hidden=!textEnabled;$('text-consent').checked=false;$('text-status').textContent='';
 $('ask-root').disabled=!textEnabled||!$('text').value.trim();
 $('request-hint').textContent=t(textEnabled?'textHint':audience==='customer'?'requestCustomer':'requestBusiness');
 $('media-entry').hidden=audience!=='business';
 $('customer-search').hidden=audience!=='customer'||!context;
 $('search-consent').checked=false;$('search-status').textContent='';$('search-results').replaceChildren();
 const request=window.CustomerUnderstanding.buildCustomerUnderstanding('',$('text').value);
 $('search-request').textContent=request?.understanding||t('searchPrompt');$('search-customer').disabled=!request;
}
function option(value,text){const n=document.createElement('option');n.value=value;n.textContent=text;return n;}
shared.languages.forEach(l=>$('language').append(option(l.code,l.name)));
function cancelRequest(){if(activeRequest){activeRequest.abort();activeRequest=null;}busy=false;['run','save-work','load-selling','share-selling','visual-run','runtime-preflight','ask-root'].forEach(id=>$(id).disabled=false);$('visual-consent').checked=false;$('preflight-status').textContent='';}
function reset(){sequence++;cancelRequest();$('text-diagnostics').open=false;$('category-diagnostics').open=false;$('development-tools').open=false;context=null;sharedProducts=[];$('share-consent').checked=false;$('selling-product').replaceChildren();$('selling-product').hidden=true;$('share-selling').hidden=true;$('load-selling').disabled=false;$('share-selling').disabled=false;$('integration-status').textContent='';$('integration').hidden=audience!=='business';$('workspace').hidden=true;$('result').hidden=true;$('analysis-save').hidden=true;$('text').value='';$('count').textContent='0 / 500';$('filter').value='';$('evidence').replaceChildren();$('capabilities').replaceChildren();$('category').replaceChildren();syncCustomerSearch();}
function status(key){$('status').textContent=t(key==='ready'&&context?.runtime?.controlledText?'textReady':key);$('retry').hidden=key!=='error';}
function clearSaved(){$('analysis-save').hidden=true;selectedWork=null;saveRequestId=null;$('save-consent').checked=false;$('saved-work').hidden=true;$('work-review').hidden=true;$('work-history').replaceChildren();$('review-text').value='';$('save-status').textContent='';$('review-status').textContent='';$('save-work').disabled=false;$('visual-run').disabled=false;syncVisual();}
function syncVisual(){const enabled=audience==='business'&&context?.runtime?.controlledSellingVisual===true&&sharedProducts.length>0&&$('share-consent').checked;$('visual-tool').hidden=!enabled;if(!enabled)$('visual-consent').checked=false;}
function invalidate(){sequence++;cancelRequest();selectedWork=null;saveRequestId=null;$('save-consent').checked=false;$('work-review').hidden=true;$('save-work').disabled=false;$('run').disabled=false;$('load-selling').disabled=false;$('share-selling').disabled=false;$('result').hidden=true;$('analysis-save').hidden=true;syncCustomerSearch();}
function translate(){document.documentElement.lang=locale;document.documentElement.dir=shared.resolve(locale).direction;$('language').value=locale;document.querySelectorAll('[data-copy]').forEach(n=>{const key=n.dataset.copy;n.textContent=copy.keys.includes(key)?t(key):shared.translate(locale,({signin:'Sign in',signout:'Sign out',retry:'Try again',language:'Language',privacy:'Privacy',terms:'Terms',skip:'Skip to content'})[key]||key);});}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),15000);})]);}finally{clearTimeout(timer);}}
async function api(body){
 const turn=sequence,session=clerk.session;
 const token=await bounded(session.getToken());
 // Token resolution can outlive sign-out, edits or a context change. Never
 // send that old request with a new workspace or session after it resolves.
 if(turn!==sequence||session!==clerk?.session)throw Error('cancelled');
 if(!token)throw Error('session');
 const controller=new AbortController();activeRequest=controller;
 const timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch('/api/root/workspace'+(body?'':'?audience='+audience),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok){const error=Error('unavailable');error.status=response.status;throw error;}return await response.json();}
 finally{clearTimeout(timer);if(activeRequest===controller)activeRequest=null;}
}
function capabilities(){const query=$('filter').value.trim().toLocaleLowerCase();const rows=context.registry.categories.filter(c=>c.name.toLocaleLowerCase().includes(query)||c.categoryId===query);$('category-count').textContent=rows.length+' / '+context.registry.categories.length;$('capabilities').replaceChildren();rows.forEach(c=>{const li=document.createElement('li'),detail=document.createElement('small');li.textContent=c.name+' · '+c.categoryId;detail.textContent=t(c.fields.length?'fields':'unreviewed');li.append(detail);$('capabilities').append(li);});}
async function load(){reset();clearSaved();const turn=sequence;busy=false;$('run').disabled=false;$('signin').hidden=!!clerk?.user;$('signout').hidden=!clerk?.user;if(!clerk?.user||!clerk?.session){status('signedout');return;}status('loading');try{const data=await api();if(turn!==sequence)return;context=data;$('workspace').hidden=false;$('category').append(option('',t('none')));data.registry.categories.forEach(c=>$('category').append(option(c.categoryId,c.name)));capabilities();renderHistory();syncCustomerSearch();status('ready');}catch{if(turn===sequence)status('error');}}
function reviewState(work){return t(({pending:'reviewPending',accepted:'reviewAccepted',corrected:'reviewCorrected',rejected:'reviewRejected'})[work.review_state]||'reviewPending');}
function showReview(work){
 selectedWork=work;['accept-work','correct-work','reject-work'].forEach(id=>$(id).disabled=false);$('work-review').hidden=false;$('work-review-state').textContent=reviewState(work);
 const suggestions=work.result.conversation?.reply||(work.result.engine.modelExecuted?(work.result.visual?.proposals||[]).map(p=>typeof p.value==='string'?p.value:JSON.stringify(p.value)).filter(Boolean).join('\n'):work.result.source.text);
 $('review-text').value=(work.reviewed_text??suggestions).slice(0,500);$('review-status').textContent='';
}
function renderHistory(){
 const enabled=context?.history?.status==='available';$('saved-work').hidden=!enabled;document.querySelector('[data-copy="history"]').textContent=t(enabled?'savedHistory':'history');$('work-history').replaceChildren();if(!enabled)return;
 context.history.works.forEach(work=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=work.result.source.text.slice(0,80)+' · '+reviewState(work);button.addEventListener('click',()=>{invalidate();selectedWork=work;$('text').value=work.result.source.text;$('count').textContent=$('text').value.length+' / 500';$('category').value=work.result.selectedCategory?.categoryId||'';render(work.result);showReview(work);});li.append(button);$('work-history').append(li);});
}
function render(result){
 const container=$('evidence');container.replaceChildren();
 const native=result.engine.modelExecuted===true;
 const text=document.createElement('blockquote');text.textContent=result.source.text;
 // Category matching and field checklists are development diagnostics, not
 // evidence produced or verified by the model. Keep them available separately.
 const diagnostics=native?document.createElement('details'):container;
 if(native){
  const summary=document.createElement('summary');summary.textContent=t('categoryDiagnostic');
  diagnostics.className='diagnostics';diagnostics.append(summary);
  container.append(text);
 }
 const heading=document.createElement('p');heading.textContent=t('matched')+': '+(result.literalCategoryEvidence.map(c=>c.name).join(', ')||'—');diagnostics.append(heading);
 if(!native)container.append(text);
 if(result.selectedCategory){
  const title=document.createElement('p');title.textContent=result.selectedCategory.name+' · '+t('checklist');diagnostics.append(title);
  if(!result.checklist.length){const p=document.createElement('p');p.textContent=t('unreviewed');diagnostics.append(p);}
  result.checklist.forEach(field=>{const p=document.createElement('p');p.textContent=shared.translate(locale,field.label);diagnostics.append(p);});
 }
 if(native&&result.visual){
  const p=document.createElement('p');p.textContent=t('modelEvidence');container.append(p);
  for(const proposal of result.visual.proposals||[]){const value=document.createElement('p');value.textContent=typeof proposal.value==='string'?proposal.value:JSON.stringify(proposal.value);container.append(value);}
 }
 if(native&&result.conversation){const label=document.createElement('p'),reply=document.createElement('p');label.textContent=t('modelEvidence');reply.textContent=result.conversation.reply;container.append(label,reply);}
 if(native&&!result.conversation)container.append(diagnostics);
 $('save-work').disabled=native;$('analysis-save').hidden=native||context?.history?.status!=='available';$('result').hidden=false;syncCustomerSearch();
}
$('ask-root').addEventListener('click',async()=>{
 if(busy||!context?.runtime?.controlledText||context?.history?.status!=='available'||!$('text-consent').checked||!$('text').value.trim())return;
 busy=true;saveRequestId=saveRequestId||crypto.randomUUID();const turn=++sequence;
 $('ask-root').disabled=true;$('result').hidden=true;$('analysis-save').hidden=true;$('text-status').textContent=t('loading');
 // Each request sends only its current text. History, category selections and
 // Selling records are never included or implicitly turned into model tools.
 try{
  const data=await api({action:'ask-root',audience,locale,text:$('text').value,confirmed:true,saveConfirmed:true,requestId:saveRequestId});if(turn!==sequence)return;
  if(data.result?.engine?.kind!=='native-root-text'||typeof data.result.conversation?.reply!=='string'||!data.work)throw Error('invalid-reply');
  context.history.works=[data.work,...context.history.works.filter(w=>w.work_id!==data.work.work_id)].slice(0,50);
  renderHistory();render(data.result);showReview(data.work);$('text-status').textContent=t('modelDone');status('textReady');
 }catch{if(turn===sequence)$('text-status').textContent=t('error');}
 finally{if(turn===sequence){busy=false;$('ask-root').disabled=false;$('text-consent').checked=false;}}
});
$('search-customer').addEventListener('click',async()=>{
 if(busy||!context||audience!=='customer'||!$('search-consent').checked||!$('text').value.trim())return;
 busy=true;const turn=++sequence;$('search-customer').disabled=true;$('search-results').replaceChildren();$('search-status').textContent=t('loading');
 try{
  const data=await api({action:'search-customer',audience:'customer',locale,text:$('text').value,confirmed:true});if(turn!==sequence)return;
  const matches=data.search?.possibilities;
  if(!Array.isArray(matches)||matches.length>5||matches.some(row=>!row||typeof row.businessName!=='string'||typeof row.content!=='string'))throw Error('invalid-search');
  for(const row of matches){const li=document.createElement('li'),name=document.createElement('strong'),content=document.createElement('p');name.textContent=row.businessName;content.textContent=row.content;li.append(name,content);for(const product of (row.products||[]).slice(0,5)){const p=document.createElement('p');p.textContent=product.name;li.append(p);}$('search-results').append(li);}
  $('search-status').textContent=t(matches.length?'searchFound':'searchEmpty');
 }catch{if(turn===sequence){$('search-results').replaceChildren();$('search-status').textContent=t('error');}}
 finally{if(turn===sequence){busy=false;$('search-customer').disabled=false;$('search-consent').checked=false;}}
});
$('understanding').addEventListener('submit',async event=>{event.preventDefault();if(busy||!context)return;busy=true;$('run').disabled=true;$('result').hidden=true;$('analysis-save').hidden=true;const turn=++sequence;status('loading');try{const data=await api({action:'understand',audience,locale,text:$('text').value,categoryId:$('category').value});if(turn!==sequence)return;render(data.result);status('ready');}catch{if(turn===sequence)status('error');}finally{if(turn===sequence){busy=false;$('run').disabled=false;}}});
['business','customer'].forEach(mode=>$(mode).addEventListener('click',()=>{audience=mode;['business','customer'].forEach(x=>$(x).setAttribute('aria-pressed',String(x===mode)));load();}));
$('language').addEventListener('change',()=>{locale=shared.resolve($('language').value).code;try{localStorage.setItem('demeos-customer-language',locale);}catch{}translate();load();});
$('text').addEventListener('input',()=>{invalidate();$('count').textContent=$('text').value.length+' / 500';});
$('category').addEventListener('change',invalidate);
$('filter').addEventListener('input',()=>{if(context)capabilities();});$('clear').addEventListener('click',()=>{load();});
$('signout').addEventListener('click',async()=>{reset();try{await bounded(clerk.signOut());await load();}catch{status('error');}});
$('signin').addEventListener('click',()=>{if(clerk)clerk.openSignIn({forceRedirectUrl:location.origin+'/root-ai',fallbackRedirectUrl:location.origin+'/root-ai',signUpForceRedirectUrl:location.origin+'/root-ai',signUpFallbackRedirectUrl:location.origin+'/root-ai'});});
$('retry').addEventListener('click',()=>{if(clerk)load();else start();});
$('save-work').addEventListener('click',async()=>{
 if(busy||$('analysis-save').hidden||context?.history?.status!=='available'||!$('save-consent').checked||$('result').hidden)return;
 busy=true;saveRequestId=saveRequestId||crypto.randomUUID();const turn=++sequence;$('save-work').disabled=true;$('save-status').textContent=t('loading');
 try{const data=await api({action:'save-work',audience,locale,text:$('text').value,categoryId:$('category').value,confirmed:true,requestId:saveRequestId});if(turn!==sequence)return;context.history.works=[data.work,...context.history.works.filter(w=>w.work_id!==data.work.work_id)].slice(0,50);renderHistory();$('save-status').textContent=t('workSaved');}
 catch{if(turn===sequence)$('save-status').textContent=t('error');}finally{if(turn===sequence){busy=false;$('save-work').disabled=false;}}
});
for(const [id,decision] of [['accept-work','accepted'],['correct-work','corrected'],['reject-work','rejected']])$(id).addEventListener('click',async()=>{
 if(busy||!selectedWork)return;busy=true;const turn=++sequence;const work=selectedWork;$('review-status').textContent=t('loading');
 try{const data=await api({action:'review-work',audience,confirmed:true,workId:work.work_id,revision:work.revision,decision,...(decision==='corrected'?{text:$('review-text').value}:{})});if(turn!==sequence)return;selectedWork=data.work;context.history.works=context.history.works.map(w=>w.work_id===data.work.work_id?data.work:w);renderHistory();showReview(data.work);$('review-status').textContent=t('reviewSaved');}
 catch(error){
  if(turn===sequence){
   if(error.status===409){
    // Keep the unsaved correction visible, but require reopening a current
    // revision. A fresh GET reloads only this authenticated personal history.
    selectedWork=null;['accept-work','correct-work','reject-work'].forEach(id=>$(id).disabled=true);
    $('review-status').textContent=t('reviewConflict');
    try{const fresh=await api();if(turn===sequence&&fresh.history?.status==='available'){context.history=fresh.history;renderHistory();$('review-status').textContent=t('reviewConflict');}}catch{if(turn===sequence)$('review-status').textContent=t('reviewConflict');}
   }else $('review-status').textContent=t('error');
  }
 }finally{if(turn===sequence)busy=false;}
});
$('selling-product').addEventListener('change',()=>{invalidate();$('integration-status').textContent='';});
$('share-consent').addEventListener('change',()=>{invalidate();sharedProducts=[];$('selling-product').replaceChildren();$('selling-product').hidden=true;$('share-selling').hidden=true;$('integration-status').textContent='';syncVisual();});
$('load-selling').addEventListener('click',async()=>{
 if(busy||!context||!$('share-consent').checked)return;
 busy=true;const turn=++sequence;$('load-selling').disabled=true;$('integration-status').textContent=t('loading');
 try{const data=await api({action:'selling-options',audience:'business',confirmed:true});if(turn!==sequence)return;sharedProducts=data.products;$('selling-product').replaceChildren();sharedProducts.forEach((p,index)=>$('selling-product').append(option(String(index),p.businessName+' · '+p.name)));$('selling-product').hidden=!sharedProducts.length;$('share-selling').hidden=!sharedProducts.length;$('integration-status').textContent=sharedProducts.length?'':t('noSelling');}
 catch{if(turn===sequence)$('integration-status').textContent=t('error');}
 finally{if(turn===sequence){busy=false;$('load-selling').disabled=false;syncVisual();}}
});
$('share-selling').addEventListener('click',async()=>{
 const selected=sharedProducts[Number($('selling-product').value)];if(busy||!selected||!context||!$('share-consent').checked)return;
 busy=true;const turn=++sequence;$('share-selling').disabled=true;$('result').hidden=true;$('analysis-save').hidden=true;$('integration-status').textContent=t('loading');
 try{const data=await api({action:'understand-selling',audience:'business',confirmed:true,locale,businessId:selected.businessId,productId:selected.productId,revision:selected.revision});if(turn!==sequence)return;$('text').value=data.result.source.text;$('count').textContent=$('text').value.length+' / 500';$('category').value=data.result.selectedCategory?.categoryId||'';render(data.result);$('integration-status').textContent=t('ready');}
 catch{if(turn===sequence)$('integration-status').textContent=t('error');}
 finally{if(turn===sequence){busy=false;$('share-selling').disabled=false;}}
});
async function script(src,key){await bounded(new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=src;node.async=true;node.crossOrigin='anonymous';if(key)node.dataset.clerkPublishableKey=key;node.onload=resolve;node.onerror=reject;document.head.append(node);}));}
$('visual-run').addEventListener('click',async()=>{
 const selected=sharedProducts[Number($('selling-product').value)];if(busy||!selected||!context?.runtime?.controlledSellingVisual||!$('share-consent').checked||!$('visual-consent').checked)return;
 busy=true;const turn=++sequence;$('visual-run').disabled=true;$('integration-status').textContent=t('loading');$('result').hidden=true;$('analysis-save').hidden=true;
 try{const data=await api({action:'visual-selling',audience:'business',confirmed:true,saveConfirmed:true,requestId:crypto.randomUUID(),locale,businessId:selected.businessId,productId:selected.productId,revision:selected.revision});if(turn!==sequence)return;context.history.works=[data.work,...context.history.works.filter(w=>w.work_id!==data.work.work_id)].slice(0,50);$('text').value=data.result.source.text;$('count').textContent=$('text').value.length+' / 500';$('category').value=data.result.selectedCategory?.categoryId||'';renderHistory();render(data.result);showReview(data.work);$('integration-status').textContent=t('modelDone');status('modelDone');}
 catch{if(turn===sequence)$('integration-status').textContent=t('error');}finally{if(turn===sequence){busy=false;$('visual-run').disabled=false;}}
});
$('runtime-preflight').addEventListener('click',async()=>{
 if(busy||!context?.runtime?.controlledSellingVisual||!$('share-consent').checked)return;busy=true;const turn=++sequence;$('runtime-preflight').disabled=true;$('preflight-status').textContent=t('loading');
 try{const data=await api({action:'prepare-controlled-runtime',audience:'business',confirmed:true});if(turn!==sequence)return;$('preflight-status').textContent=t('connectionReady')+' '+data.health.connectionPreflightMs+' ms';}catch{if(turn===sequence)$('preflight-status').textContent=t('error');}finally{if(turn===sequence){busy=false;$('runtime-preflight').disabled=false;}}
});
async function start(){if(booting)return;booting=true;status('loading');try{const response=await bounded(fetch('/api/public-config',{cache:'no-store'}));if(!response.ok)throw Error();const config=await response.json(),key=config.clerkPublishableKey;if(typeof key!=='string'||!/^pk_(test|live)_/.test(key))throw Error();const domain=atob(key.split('_')[2]).replace(/\$$/,'');if(!/^[a-z0-9.-]+$/i.test(domain))throw Error();if(!window.__internal_ClerkUICtor)await script('https://'+domain+'/npm/@clerk/ui@1/dist/ui.browser.js');if(!window.Clerk)await script('https://'+domain+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js',key);clerk=window.Clerk;const translation=await bounded(fetch(locale==='tr'?'/js/selling-auth-tr.json':'/js/customer-auth-locales/'+locale+'.json'));if(!translation.ok)throw Error();await bounded(clerk.load({signInForceRedirectUrl:location.origin+'/root-ai',signUpForceRedirectUrl:location.origin+'/root-ai',signInFallbackRedirectUrl:location.origin+'/root-ai',signUpFallbackRedirectUrl:location.origin+'/root-ai',ui:{ClerkUI:window.__internal_ClerkUICtor},localization:await translation.json()}));if(new URLSearchParams(location.search).get('clerk_oauth_callback')==='1')await bounded(clerk.handleRedirectCallback({signInForceRedirectUrl:location.origin+'/root-ai',signUpForceRedirectUrl:location.origin+'/root-ai',signInFallbackRedirectUrl:location.origin+'/root-ai',signUpFallbackRedirectUrl:location.origin+'/root-ai'}));clerk.addListener(()=>{const key=(clerk.user?.id||'')+':'+(clerk.session?.id||'');if(key!==sessionKey){sessionKey=key;load();}});sessionKey=(clerk.user?.id||'')+':'+(clerk.session?.id||'');await load();}catch{clerk=null;reset();status('error');}finally{booting=false;}}
translate();start();
})();
