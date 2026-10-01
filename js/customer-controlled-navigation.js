/* Explicit controlled context follows AREA 1 links only; normal visits stay normal. */
(function(root){'use strict';function update(link){
 const url=new URL(root.location.href);const preparation=root.DEMEOSCustomerPurchasePreparation;
 if(url.searchParams.get('demeos-test')!=='1'&&!(url.searchParams.get('prepare')==='1'&&preparation&&preparation.read()))return;

  const href=link.getAttribute('href');if(href.startsWith('#'))return;const target=new URL(href,url);if(target.origin!==url.origin||!/(?:customer|my-demeos)\.html$/.test(target.pathname))return;
  target.searchParams.set('demeos-test','1');link.setAttribute('href',target.pathname+target.search+target.hash);
}
root.document.addEventListener('click',event=>{const link=event.target.closest&&event.target.closest('.customer-journey-nav a, .customer-brand, #purchase-preparation-privacy');if(link)update(link);},true);
root.document.addEventListener('DOMContentLoaded',()=>root.document.querySelectorAll('.customer-journey-nav a, .customer-brand, #purchase-preparation-privacy').forEach(update));
}(window));
