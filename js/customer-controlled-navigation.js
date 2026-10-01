/* Explicit controlled context follows AREA 1 links only; normal visits stay normal. */
(function(root){'use strict';root.document.addEventListener('DOMContentLoaded',()=>{
 const url=new URL(root.location.href);const preparation=root.DEMEOSCustomerPurchasePreparation;
 if(url.searchParams.get('demeos-test')!=='1'&&!(url.searchParams.get('prepare')==='1'&&preparation&&preparation.read()))return;
 root.document.querySelectorAll('.customer-journey-nav a, .customer-brand, #purchase-preparation-privacy').forEach(link=>{
  const href=link.getAttribute('href');if(href.startsWith('#'))return;const target=new URL(href,url);if(target.origin!==url.origin||!/(?:customer|my-demeos)\.html$/.test(target.pathname))return;
  target.searchParams.set('demeos-test','1');link.setAttribute('href',target.pathname+target.search+target.hash);
 });
});}(window));
