/* Own-customer status only. A redirect or browser flag never proves payment. */
(function(root){
 'use strict';const doc=root.document;
 let receipt=null,receipts=[],message='paymentSignIn',busy=false,generation=0;
 const get=id=>doc.getElementById(id),code=()=>doc.documentElement.lang||'en';
 const copy=()=>root.DEMEOSPurchasePreparationCopy[code()]||root.DEMEOSPurchasePreparationCopy.en;
 const set=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
 function render(){
  const c=copy();set(get('customer-payment-title'),new URL(root.location.href).searchParams.has('payment')?c.paymentTitle:c.paymentHistory);set(get('customer-payment-refresh'),c.paymentRefresh);
  get('customer-payment-refresh').disabled=busy;set(get('customer-payment-message'),c[message]||c.failed);
  const history=get('customer-payment-history');history.replaceChildren();
  for(const entry of receipts){
   const cstate={creating:'paymentPending',pending:'paymentPending',paid:'paymentPaid',failed:'paymentFailed',cancelled:'paymentCancelled','partially-refunded':'paymentPartialRefund',refunded:'paymentRefunded'}[entry.state];
   if(entry.testMode!==true||entry.recipient!=='business'||!cstate||typeof entry.productId!=='string'||typeof entry.reference!=='string'||!/^[a-zA-Z0-9-]{1,200}$/.test(entry.reference))continue;
   const p=['activewear','summer-fashion','mens-fashion','running','football','fishing','camping','hiking','childrens-fashion','toys','childrens-collection','grocery-pack'].indexOf(entry.productId.replace('test-product-',''));
   const link=doc.createElement('a');link.className='customer-payment-history-link';link.href='/my-demeos.html?payment='+encodeURIComponent(entry.reference);
   const name=doc.createElement('strong'),state=doc.createElement('span');const owned=root.DEMEOSControlledCustomerCopy[code()];name.textContent=p<0?entry.productName:owned.test+' '+owned.products[p];state.textContent=c[cstate];link.append(name,state);history.append(link);
  }
  const summary=get('customer-payment-summary');summary.replaceChildren();if(!receipt)return;
  const owned=root.DEMEOSControlledCustomerCopy[code()],item=root.DEMEOSItemPresentationCopy[code()];
  const products=['activewear','summer-fashion','mens-fashion','running','football','fishing','camping','hiking','childrens-fashion','toys','childrens-collection','grocery-pack'];
  const pi=products.indexOf(receipt.productId.replace('test-product-',''));
  const bi=['fashion','groceries','sports','outdoors','family','garden'].findIndex(k=>receipt.businessId.endsWith('-'+k));
  const money=new Intl.NumberFormat(code(),{style:'currency',currency:receipt.currency});const factor=10**money.resolvedOptions().maximumFractionDigits;
  const state={creating:'paymentPending',pending:'paymentPending',paid:'paymentPaid',failed:'paymentFailed',cancelled:'paymentCancelled','partially-refunded':'paymentPartialRefund',refunded:'paymentRefunded'}[receipt.state];
  if(!state){set(get('customer-payment-message'),c.failed);return;}
  const rows=[[c.paymentReference,receipt.reference],[c.paymentStatus,c[state]],[owned.business,bi<0?receipt.sellerName:'DEMEOS '+owned.test+' '+owned.categories[bi]],[item[pi>=3&&pi<=7?'service':'product'],pi<0?receipt.productName:owned.test+' '+owned.products[pi]],[c.quantity,String(receipt.quantity)],[c.paymentTotal,money.format(receipt.totalMinor/factor)]];
  for(const [field,value] of Object.entries(receipt.selection||{}))rows.push([item.fields[field]||field,item.values[value]||value]);
  if(receipt.refundedMinor>0)rows.push([c.refundTotal,money.format(receipt.refundedMinor/factor)]);
  for(const [label,value] of rows){const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value;summary.append(dt,dd);}
 }
 async function refresh(){
  const revision=++generation;receipt=null;receipts=[];busy=true;message='paymentChecking';render();
  const reference=new URL(root.location.href).searchParams.get('payment');
  try{
   if(reference!==null&&!/^[a-zA-Z0-9-]{1,200}$/.test(reference)){message='paymentMissing';return;}
   const response=await root.fetch('/api/customer/checkout?demeos-test=1'+(reference?'&reference='+encodeURIComponent(reference):''),{credentials:'same-origin',cache:'no-store',headers:{'x-demeos-test-mode':'controlled-preview'}});
   const data=await response.json();if(revision!==generation)return;
   if(response.status===401){message='paymentSignIn';return;}
   if(response.status===404){message='paymentMissing';return;}
   if(reference===null&&response.ok&&data.ready&&Array.isArray(data.receipts)){receipts=data.receipts.slice(0,50);message=receipts.length?'test':data.reason==='gateway-not-configured'?'gatewayUnavailable':'paymentEmpty';return;}
   if(response.ok&&data.ready&&data.receipt?.testMode===true&&data.receipt.recipient==='business'&&data.receipt.reference===reference){receipt=data.receipt;message='test';return;}
   message=data.reason==='gateway-not-configured'?'gatewayUnavailable':'failed';
  }catch(_){if(revision===generation)message='failed';}finally{if(revision===generation){busy=false;render();}}
 }
 function clear(){get('customer-payment-panel').hidden=true;generation++;receipt=null;receipts=[];busy=false;message='paymentSignIn';render();}
 doc.addEventListener('DOMContentLoaded',async()=>{
  const panel=get('customer-payment-panel');if(!panel)return;
  // Receipts keep their permanent account address. The server-selected feed,
  // rather than a public URL flag, identifies the temporary-content journey.
  if(!new URL(root.location.href).searchParams.has('payment')){
   try{const response=await root.fetch('/api/customer/work?source=discover&demeos-test=1',{credentials:'same-origin',cache:'no-store',headers:{'x-demeos-test-mode':'controlled-preview'}});const data=await response.json();if(!response.ok||data.testMode!==true||!Array.isArray(data.work)||!data.work.length)return;}catch(_){return;}
  }
  panel.hidden=get('customer-auth-signed-in').hidden;render();get('customer-payment-refresh').addEventListener('click',refresh);
  get('customer-sign-out')?.addEventListener('click',clear);
  const auth=get('customer-auth-signed-in');new root.MutationObserver(()=>{if(auth.hidden)clear();else {panel.hidden=false;refresh();}}).observe(auth,{attributes:true,attributeFilter:['hidden']});
  new root.MutationObserver(render).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  if(!auth.hidden)refresh();
 });
})(typeof window!=='undefined'?window:{});
