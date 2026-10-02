/* One-tab selection draft only. No identity, address, order or payment is stored. */
(function(root){
 'use strict';
 const contract=root.DEMEOSPurchasePreparationContract,key='demeos-controlled-preparation-v1';
 const doc=root.document;
 let preparation=null,details={},boundary=false,busy=false,generation=0,checkoutKey=null,checkoutMessage='';
 const code=()=>doc.documentElement.lang||'en';
 const copy=()=>root.DEMEOSPurchasePreparationCopy[code()]||root.DEMEOSPurchasePreparationCopy.en;
 const get=id=>doc.getElementById(id);
 const set=(n,v)=>{if(n&&n.textContent!==v)n.textContent=v;};
 function read(){try{const value=contract.draft(JSON.parse(root.sessionStorage.getItem(key)));if(!value)root.sessionStorage.removeItem(key);return value;}catch(_){return null;}}
 function write(value){try{root.sessionStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
 function clear(){root.DEMEOSCheckoutRecovery?.clear(root.sessionStorage);try{root.sessionStorage.removeItem(key);}catch(_){}details={};preparation=null;boundary=false;checkoutKey=null;checkoutMessage='';generation++;}
 function consumeResume(){const url=new URL(root.location.href);url.searchParams.delete("resume");root.history.replaceState(null,"",url.pathname+url.search+url.hash);}
 function controlled(){return new URL(root.location.href).searchParams.get('demeos-test')==='1';}
 function authenticationPath(){return new URL(root.location.href).searchParams.get('prepare')==='1'&&read()?root.location.origin+'/my-demeos.html?prepare=1':null;}
 function authenticationReturn(){if(!authenticationPath())return false;root.location.replace('/customer.html?demeos-test=1&resume=1#product-experience');return true;}
 function product(active){
  let row=get('purchase-preparation-quantity');
  if(!row){row=doc.createElement('label');row.id='purchase-preparation-quantity';row.className='customer-item-option';const span=doc.createElement('span');row.appendChild(span);const input=doc.createElement('input');input.type='number';input.min='1';input.max='20';input.step='1';input.value='1';row.appendChild(input);get('product-experience-action').before(row);}
  const identity=(active.work?.workItemId||'')+'|'+active.product.productId;
  if(row.getAttribute('data-item')!==identity){row.setAttribute('data-item',identity);row.querySelector('input').value='1';}
  row.hidden=active.product.continuationRoute!=='demeos'||active.product.presentation.kind!=='product'||active.product.fulfilment?.quantityEnabled!==true||active.product.presentation.options.some(o=>o.key==='quantity')||!controlled();
  set(row.querySelector('span'),copy().quantity);
 }
 function currentDraft(){
  const a=root.DEMEOSCustomerItemPresentation.snapshot();if(!a||!a.work?.workItemId||a.product.continuationRoute!=='demeos'||a.surface.getAttribute('data-controlled-test')!=='true'||!controlled())return null;
  const quantity=a.product.presentation.kind==='product'&&a.product.fulfilment?.quantityEnabled===true&&!a.product.presentation.options.some(o=>o.key==='quantity')?Number(get('purchase-preparation-quantity').querySelector('input').value):1;
  return contract.draft({version:1,workItemId:a.work.workItemId,productId:a.product.productId,selection:{...a.selection},quantity,expires:Date.now()+1800000});
 }
 async function request(draft,review=false,submittedDetails=details){
  const response=await root.fetch('/api/customer/preparation?demeos-test=1',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','x-demeos-test-mode':'controlled-preview'},body:JSON.stringify({draft,review,...(review?{details:submittedDetails}:{})})});
  if(response.status===401)return {auth:true};
  const data=await response.json();return response.ok&&data.ready&&data.paymentActive===false&&data.orderCreated===false?data:{error:data.reason||'failed'};
 }
 function status(reason){set(get('purchase-preparation-status'),copy()[reason]||copy().failed);}
 function show(){const url=new URL(root.location.href);url.hash='purchase-preparation';root.history.replaceState(null,'',url.pathname+url.search+url.hash);get('discover').hidden=true;get('intention').hidden=true;get('product-experience').hidden=true;get('purchase-preparation').hidden=false;get('purchase-preparation').querySelector('.customer-product-experience-shell').scrollTop=0;root.scrollTo({top:0,behavior:'instant'});get('purchase-preparation-title').focus({preventScroll:true});}
 function names(p){
  const c=root.DEMEOSControlledCustomerCopy[code()];
  const pi=['activewear','summer-fashion','mens-fashion','running','football','fishing','camping','hiking','childrens-fashion','toys','childrens-collection','grocery-pack'].indexOf(p.product.productId.replace('test-product-',''));
  const bi=['fashion','groceries','sports','outdoors','family','garden'].indexOf(p.business.workItemId.replace('test-discover-',''));
  return {product:c.test+' '+c.products[pi],business:'DEMEOS '+c.test+' '+c.categories[bi]};
 }
 function render(){
  if(!get('purchase-preparation'))return;
  const c=copy();set(get('purchase-preparation-title'),boundary?c.ready:c.title);set(get('purchase-preparation-test'),c.test);
  get('purchase-preparation-review').disabled=busy||!preparation;set(get('purchase-preparation-review'),c.review);set(get('purchase-preparation-back'),c.back);set(get('purchase-preparation-discard'),c.discard);set(get('purchase-preparation-edit'),c.edit);set(get('purchase-preparation-privacy'),c.privacy);set(get('purchase-preparation-boundary'),c.inactive);
  get('purchase-preparation-boundary').hidden=!boundary;get('purchase-preparation-form').hidden=boundary||!preparation;get('purchase-preparation-edit').hidden=!boundary;
  if(get('customer-payment-action')){get('customer-payment-action').hidden=!boundary;get('customer-payment-action').disabled=busy;set(get('customer-payment-action'),c.pay);set(get('customer-payment-message'),checkoutMessage?c[checkoutMessage]:'');}
  if(!preparation){const image=get("purchase-preparation-image");if(image){image.hidden=true;image.removeAttribute("src");}get("purchase-preparation-summary").replaceChildren();return;}
  const p=preparation,n=names(p),item=root.DEMEOSItemPresentationCopy[code()],productCopy=root.DEMEOSProductExperienceCopy[code()];
  const selected=p.product.presentation.options.map(field=>item.fields[field.key]+': '+root.DEMEOSCustomerItemPresentation.choiceLabel(field,field.values.find(v=>v.value===p.draft.selection[field.key]))).join(' · ');
  const rows=[[root.DEMEOSControlledCustomerCopy[code()].business,n.business],[item[p.product.presentation.kind],n.product],[c.selected,selected],[c.price,root.DEMEOSCustomerItemPresentation.price(p.state.pricing)],[c.availability,p.product.presentation.kind==='service'?item[p.state.availability==='limited'?'serviceLimited':'serviceAvailable']:productCopy[p.state.availability]]];
  if(p.product.presentation.kind==='product'&&p.product.fulfilment?.quantityEnabled===true&&!p.product.presentation.options.some(o=>o.key==='quantity'))rows.push([c.quantity,String(p.draft.quantity)]);
  if(p.state.pricing.mode==='fixed'&&Number.isFinite(p.state.pricing.amount))rows.push([c.total,root.DEMEOSCustomerItemPresentation.price({...p.state.pricing,amount:Math.round(p.state.pricing.amount*p.draft.quantity*100)/100})]);
  const image=get('purchase-preparation-image');if(image){image.src=p.product.imageUrl||'';image.alt=n.product;image.hidden=!p.product.imageUrl;}
  rows.push([c.account,c.identity]);
  rows.push([p.method==='appointment'?c.service:c[p.method],p.method==='collection'?c.collectionNote:p.method==='digital'?c.digital:c.details]);
  if(boundary)for(const field of contract.fields(p))rows.push([c[field],details[field]]);
  const summary=get('purchase-preparation-summary');summary.replaceChildren();for(const [label,value] of rows){if(!value)continue;const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value;summary.append(dt,dd);}
  const fields=get('purchase-preparation-details');const fieldKeys=contract.fields(p);
  // Preserve typed details when language changes; rebuilding happens only for a new item.
  if(fields.getAttribute('data-fields')!==p.draft.workItemId+'|'+p.draft.productId+'|'+fieldKeys.join(',')){
   fields.replaceChildren();fields.setAttribute('data-fields',p.draft.workItemId+'|'+p.draft.productId+'|'+fieldKeys.join(','));
   const legend=doc.createElement('legend');fields.appendChild(legend);
   for(const field of fieldKeys){const label=doc.createElement('label');label.className='customer-item-option';label.setAttribute('data-detail-field',field);const span=doc.createElement('span'),input=doc.createElement('input');input.name=field;input.required=true;input.maxLength=200;input.type=field==='date'?'date':field==='people'?'number':'text';if(field==='people'){input.min='1';input.max='99';input.step='1';}input.autocomplete=({recipient:'name',address:'street-address',city:'address-level2',postalCode:'postal-code',country:'country-name'})[field]||'off';input.value=details[field]||'';input.addEventListener('input',()=>{details[field]=input.value;});label.append(span,input);fields.appendChild(label);}
  }
  fields.disabled=busy;fields.hidden=!fieldKeys.length;set(fields.querySelector('legend'),c.details);fields.querySelectorAll('label').forEach(l=>set(l.querySelector('span'),c[l.getAttribute('data-detail-field')]));
 }
 async function start(){
  if(busy)return;const draft=currentDraft();if(!draft){const input=get('purchase-preparation-quantity')?.querySelector('input');if(input&&!input.checkValidity())input.reportValidity();return;}if(!write(draft)){show();render();status('failed');return;}
  busy=true;const revision=++generation;boundary=false;checkoutKey=null;checkoutMessage='';
  if(!preparation||preparation.draft.workItemId!==draft.workItemId||preparation.draft.productId!==draft.productId)details={};
  preparation=null;show();render();status('checking');
  try{
   const result=await request(draft);if(revision!==generation)return;
   if(result.auth){root.location.assign('/my-demeos.html?prepare=1');return;}
   if(result.error){status(result.error==='unavailable'?'unavailable':'failed');return;}
   preparation=result.preparation;set(get('purchase-preparation-status'),'');render();
  }catch(_){if(revision===generation)status('failed');}finally{if(revision===generation){busy=false;render();}}
 }
 async function review(event){
  event.preventDefault();if(busy||!preparation)return;
  if(!contract.validDetails(preparation,details)){status('required');return;}
  const submittedDetails={...details};busy=true;get('purchase-preparation-details').disabled=true;get('purchase-preparation-review').disabled=true;const revision=++generation;status('checking');
  try{
   const result=await request(preparation.draft,true,submittedDetails);if(revision!==generation)return;
   if(result.auth){root.location.assign('/my-demeos.html?prepare=1');return;}
   if(result.error){boundary=false;status(result.error==='unavailable'?'unavailable':'failed');return;}
   preparation=result.preparation;details=submittedDetails;boundary=true;set(get('purchase-preparation-status'),'');render();
  }catch(_){if(revision===generation)status('failed');}finally{if(revision===generation){busy=false;get('purchase-preparation-details').disabled=false;get('purchase-preparation-review').disabled=false;render();}}
 }
 async function checkout(){
  if(busy||!boundary||!preparation)return;
  if(!checkoutKey){if(typeof root.crypto?.randomUUID!=='function'){checkoutMessage='failed';render();return;}checkoutKey=root.DEMEOSCheckoutRecovery.nonce(root.sessionStorage,preparation.draft,()=>root.crypto.randomUUID());if(!checkoutKey){checkoutMessage='failed';render();return;}}
  const revision=++generation;busy=true;checkoutMessage='paymentChecking';render();
  try{
   const response=await root.fetch('/api/customer/checkout?demeos-test=1',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','x-demeos-test-mode':'controlled-preview','Idempotency-Key':checkoutKey},body:JSON.stringify({draft:preparation.draft,details:{...details}})});
   if(revision!==generation)return;
   if(response.status===401){root.location.assign('/my-demeos.html?prepare=1');return;}
   const data=await response.json();if(revision!==generation)return;
   if(response.ok&&data.ready&&data.receipt?.testMode===true&&data.receipt.recipient==='business'){
    if(!/^[a-zA-Z0-9-]{1,200}$/.test(data.receipt.reference))throw Error('Invalid reference');
    if(data.checkoutUrl){const url=new URL(data.checkoutUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid checkout');root.location.assign(url.href);return;}
    root.location.assign('/my-demeos.html?demeos-test=1&payment='+encodeURIComponent(data.receipt.reference));return;
   }
   checkoutMessage=data.reason==='gateway-not-configured'?'gatewayUnavailable':data.reason==='unavailable'?'unavailable':'failed';
  }catch(_){if(revision===generation)checkoutMessage='failed';}finally{if(revision===generation){busy=false;render();}}
 }
 function back(){checkoutKey=null;root.DEMEOSCheckoutRecovery.clear(root.sessionStorage);const url=new URL(root.location.href);url.hash='product-experience';root.history.replaceState(null,'',url.pathname+url.search+url.hash);generation++;busy=false;checkoutMessage='';get('purchase-preparation').hidden=true;get('product-experience').hidden=false;boundary=false;root.DEMEOSCustomerItemPresentation.localize();}
 async function resume(){
  const resumeUrl=new URL(root.location.href);if(!controlled()||(resumeUrl.searchParams.get('resume')!=='1'&&resumeUrl.hash!=='#purchase-preparation'&&resumeUrl.hash!=='#product-experience'))return;
  const draft=read();if(!draft)return;const productOnly=resumeUrl.searchParams.get('resume')!=='1'&&resumeUrl.hash==='#product-experience';
  const revision=++generation;
  try{
   const response=await root.fetch('/api/customer/work?demeos-test=1',{credentials:'same-origin',cache:'no-store',headers:{'x-demeos-test-mode':'controlled-preview'}});const data=await response.json();if(revision!==generation)return;
   if(!response.ok||data.testMode!==true){return;}
   const result=contract.resolve(data.work,draft);if(!result.ready){show();render();status(result.reason==='unavailable'?'unavailable':'failed');return;}
   const p=result.product;get('product-experience').setAttribute('data-controlled-test','true');root.DEMEOSCustomerProductExperience.open(doc,result.business,p,'');root.DEMEOSCustomerItemPresentation.selection(draft.selection);
   const input=get('purchase-preparation-quantity').querySelector('input');input.value=String(draft.quantity);if(productOnly){consumeResume();return;}
   const prepared=await request(draft);if(revision!==generation)return;if(prepared.auth)return;if(prepared.error){show();status(prepared.error==='unavailable'?'unavailable':'failed');return;}
   consumeResume();preparation=prepared.preparation;show();set(get('purchase-preparation-status'),'');render();if(contract.fields(preparation).length)status('restoreDetails');
  }catch(_){show();render();status('failed');}
 }
 function authBanner(){
  if(!authenticationPath())return;const parent=doc.querySelector('.my-demeos-introduction');if(!parent)return;
  const banner=doc.createElement('aside');banner.id='purchase-preparation-auth';const text=doc.createElement('p'),link=doc.createElement('a'),privacy=doc.createElement('a'),discard=doc.createElement('button');discard.type='button';discard.className='demeos-secondary-button';discard.addEventListener('click',()=>{clear();root.location.assign('/customer.html?demeos-test=1#discover');});link.href='/customer.html?demeos-test=1&resume=1#product-experience';privacy.href='#privacy-control';banner.append(text,link,privacy,discard);parent.prepend(banner);
  function localize(){set(text,copy().minimal);set(link,copy().resume);set(privacy,copy().privacy);set(discard,copy().discard);const button=get('customer-sign-in');if(button)set(button,copy().signIn);}
  localize();doc.addEventListener('change',()=>root.setTimeout(localize,0));new root.MutationObserver(localize).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 function localize(){set(get('customer-sign-in'),copy().signIn);set(get('customer-create-account'),copy().createAccount);const signedOut=get('customer-auth-signed-out');if(signedOut){set(signedOut.querySelector('h2'),copy().signIn);set(signedOut.querySelector('p'),copy().minimal);}render();const a=root.DEMEOSCustomerItemPresentation?.snapshot();if(a)product(a);}
 root.DEMEOSCustomerPurchasePreparation=Object.freeze({start,product,localize,authenticationReturn,authenticationPath,read,cancelPending:()=>{generation++;busy=false;consumeResume();}});
 doc.addEventListener('DOMContentLoaded',()=>{doc.querySelectorAll('.customer-journey-nav a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{generation++;busy=false;}));authBanner();localize();new root.MutationObserver(localize).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});if(!get('purchase-preparation'))return;get('purchase-preparation-form').addEventListener('submit',review);get('customer-payment-action').addEventListener('click',checkout);get('purchase-preparation-back').addEventListener('click',back);get('purchase-preparation-edit').addEventListener('click',()=>{boundary=false;checkoutKey=null;root.DEMEOSCheckoutRecovery.clear(root.sessionStorage);checkoutMessage='';render();});get('purchase-preparation-discard').addEventListener('click',()=>{clear();back();});resume();});
}(typeof window!=='undefined'?window:{}));
