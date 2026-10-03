/* One Customer Experience. Keep the deployment default and explicit data choices in the same journey.
 * This is navigation context, never authentication or permission to publish test records.
 * API requests still require the existing query/header pair and validate response mode. */
(function(root){
 'use strict';
 const key='demeos-customer-content-context-v1';
 const current=new URL(root.location.href);
 const choice=current.searchParams.get('demeos-test');
 // Temporary deployment policy: remove data-default-content from the two entry
 // pages when approved production content replaces the supplied development data.
 // Never infer this choice from an empty feed or an API failure.
 const defaultControlled=root.document.currentScript?.getAttribute('data-default-content')==='controlled';
 let controlled=current.searchParams.has('demeos-test')?choice==='1':defaultControlled;
 try {
  if(current.searchParams.has('demeos-test')) {
   if(controlled)root.sessionStorage.setItem(key,'controlled');
   else root.sessionStorage.setItem(key,'production');
  } else {
   const remembered=root.sessionStorage.getItem(key);
   if(remembered==='controlled'||remembered==='production')controlled=remembered==='controlled';
   else if(defaultControlled)root.sessionStorage.setItem(key,'controlled');
  }
 } catch(_) { /* Explicit URLs still work when browser storage is unavailable. */ }

 // Resolve the tab's data choice before Discover's existing request code runs.
 // Keep the purchase authentication return URL unchanged; it uses its existing draft.
 if(current.pathname.endsWith('/customer.html')&&!current.searchParams.has('demeos-test')) {
  current.searchParams.set('demeos-test',controlled?'1':'0');
  root.history.replaceState(root.history.state,'',current.pathname+current.search+current.hash);
 }

 const customerPages=new Set(['index.html','customer.html','my-demeos.html','privacy.html','terms.html','contact.html']);
 function update(link) {
  const href=link.getAttribute('href');
  if(!href||href.startsWith('#'))return;
  const target=new URL(href,current);
  if(target.origin!==current.origin||!customerPages.has(target.pathname.split('/').pop()))return;
  // An explicit exit must never be rewritten back into controlled mode.
  if(target.searchParams.has('demeos-test'))return;
  target.searchParams.set('demeos-test',controlled?'1':'0');
  link.setAttribute('href',target.pathname+target.search+target.hash);
 }
 root.document.addEventListener('click',event=>{
  const link=event.target.closest&&event.target.closest('a[href]');
  if(link)update(link);
 },true);
 root.document.addEventListener('DOMContentLoaded',()=>root.document.querySelectorAll('a[href]').forEach(update));
}(window));
