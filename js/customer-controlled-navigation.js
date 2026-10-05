/* One Customer Experience. Remember only an explicit controlled-data choice in this tab.
 * This is navigation context, never authentication or permission to publish test records.
 * API requests still require the existing query/header pair and validate response mode. */
(function(root){
 'use strict';
 const key='demeos-customer-content-context-v1';
 const current=new URL(root.location.href);
 const choice=current.searchParams.get('demeos-test');
 let controlled=choice==='1';
 let publicChoice=current.searchParams.has('demeos-test')&&!controlled;
 try {
  if(current.searchParams.has('demeos-test')) {
   if(controlled)root.sessionStorage.setItem(key,'controlled');
   else root.sessionStorage.setItem(key,'production');
  } else {
   const remembered=root.sessionStorage.getItem(key);
   controlled=remembered==='controlled';
   publicChoice=remembered==='production';
  }
 } catch(_) { /* Explicit URLs still work when browser storage is unavailable. */ }

 // Resolve the tab's data choice before Discover's existing request code runs.
 // Keep the purchase authentication return URL unchanged; it uses its existing draft.
 if(controlled&&current.pathname.endsWith('/customer.html')&&choice!=='1') {
  current.searchParams.set('demeos-test','1');
  root.history.replaceState(root.history.state,'',current.pathname+current.search+current.hash);
 }

 function refreshChoice() {
  try {
   const remembered=root.sessionStorage.getItem(key);
   controlled=remembered==='controlled';
   publicChoice=remembered==='production';
  } catch(_) { /* Retain the explicit URL choice when storage is unavailable. */ }
 }
 const originalHrefs=new WeakMap();
 const customerPages=new Set(['index.html','customer.html','my-demeos.html','privacy.html','terms.html','contact.html']);
 function update(link) {
  if(!originalHrefs.has(link))originalHrefs.set(link,link.getAttribute('href'));
  const href=originalHrefs.get(link);
  if(!href||href.startsWith('#'))return;
  const target=new URL(href,current);
  if(target.origin!==current.origin||!customerPages.has(target.pathname.split('/').pop()))return;
  // During development only the homepage Enter action selects the supplied content.
  // Loading the homepage or a clean Discover URL never activates it. An explicit
  // public choice (including exit) wins and remains public across homepage returns.
  if(link.getAttribute('data-customer-content-entry')==='controlled'&&target.pathname.endsWith('/customer.html')) {
   target.searchParams.set('demeos-test',publicChoice?'0':'1');
   link.setAttribute('href',target.pathname+target.search+target.hash);
   return;
  }
  // An explicit exit must never be rewritten back into controlled mode.
  if(target.searchParams.has('demeos-test'))return;
  if(controlled) {
   target.searchParams.set('demeos-test','1');
   link.setAttribute('href',target.pathname+target.search+target.hash);
  } else link.setAttribute('href',href);
 }
 root.addEventListener?.('pageshow',()=>{
  refreshChoice();
  root.document.querySelectorAll('a[href]').forEach(update);
 });
 root.document.addEventListener('click',event=>{
  refreshChoice();
  const link=event.target.closest&&event.target.closest('a[href]');
  if(link)update(link);
 },true);
 root.document.addEventListener('DOMContentLoaded',()=>root.document.querySelectorAll('a[href]').forEach(update));
}(window));
