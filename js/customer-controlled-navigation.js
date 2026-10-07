/* Every customer link uses the same permanent pages. Content is selected by
 * the server, never by a remembered preview URL or a customer's browser history. */
(function(root){
 'use strict';
 const pages=new Set(['index.html','customer.html','my-demeos.html','privacy.html','terms.html','contact.html']);
 const current=new URL(root.location.href);
 try{root.sessionStorage.removeItem('demeos-customer-content-context-v1');}catch(_){}
 if(current.searchParams.has('demeos-test')){
  current.searchParams.delete('demeos-test');
  root.history.replaceState(root.history.state,'',current.pathname+current.search+current.hash);
 }
 function normalize(link){
  const href=link.getAttribute('href');if(!href||href.startsWith('#'))return;
  const target=new URL(href,current);
  if(target.origin!==current.origin||!pages.has(target.pathname.split('/').pop()))return;
  if(target.searchParams.has('demeos-test')){
   target.searchParams.delete('demeos-test');link.setAttribute('href',target.pathname+target.search+target.hash);
  }
 }
 const update=()=>root.document.querySelectorAll('a[href]').forEach(normalize);
 root.document.addEventListener('DOMContentLoaded',update);
 root.addEventListener?.('pageshow',update);
 root.document.addEventListener('click',event=>{const link=event.target.closest&&event.target.closest('a[href]');if(link)normalize(link);},true);
}(window));
