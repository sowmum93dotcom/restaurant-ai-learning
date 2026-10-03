/* Public copy reuses Customer Experience language preferences; no business or payment logic. */
(function(root){
 'use strict';
 const doc=root.document,registry=root.DEMEOSLanguageRegistry,catalog=root.DEMEOSPublicCopy;
 if(!doc||!registry||!catalog)return;
 function set(node,value){if(node&&node.textContent!==value)node.textContent=value;}
 function apply(){
  const code=registry.resolve(doc.documentElement.lang).code,c=catalog[code];
  doc.querySelectorAll('[data-public-aria]').forEach(node=>node.setAttribute('aria-label',c[node.getAttribute('data-public-aria')]));
  doc.querySelectorAll('[data-public-copy]').forEach(node=>{
   if(node.id==='product-experience-safety'&&doc.getElementById('product-experience')?.getAttribute('data-controlled-test')==='true')return;
   set(node,c[node.getAttribute('data-public-copy')]);
  });
  // Shorten ordinary location guidance without implying proximity matching.
  set(doc.querySelector('label[for="customer-place"]'),c.placeLabel);
  set(doc.querySelector('.customer-understanding-trust'),c.trustReview);
  set(doc.querySelector('.customer-connection-entry>div>span'),c.connectNote);
  const status=doc.getElementById('customer-work-status');
  if(status&&!status.children.length){
   const original=root.DEMEOSCustomerInterfaceLanguage?.loadingCopy;
   const loading=Object.values(catalog).some(copy=>copy.loading===status.textContent);
   if(loading||(original&&original.includes(status.textContent)))set(status,c.loading);
  }
  if(doc.body.classList.contains('demeos-entry')){
   const title=doc.querySelector('main h1[data-public-copy]');if(title)doc.title=title.textContent+' | DEMEOS';
  }
 }
 function start(){
  const select=doc.getElementById('customer-language');
  if(select&&!select.options.length){
   registry.languages.forEach(language=>{const option=doc.createElement('option');option.value=language.code;option.textContent=language.name;select.appendChild(option);});
   let saved;try{saved=root.localStorage.getItem('demeos-customer-language');}catch(_){}
   const language=registry.resolve(saved||root.navigator?.language);doc.documentElement.lang=language.code;doc.documentElement.dir=language.direction;select.value=language.code;
   select.addEventListener('change',()=>{const language=registry.resolve(select.value);doc.documentElement.lang=language.code;doc.documentElement.dir=language.direction;try{root.localStorage.setItem('demeos-customer-language',language.code);}catch(_){}apply();});
  }
  apply();new root.MutationObserver(apply).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  const status=doc.getElementById('customer-work-status');if(status)new root.MutationObserver(apply).observe(status,{childList:true,characterData:true,subtree:true});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else start();
}(typeof window!=='undefined'?window:{}));
