(function(root){'use strict';
 if(!root.document)return;const doc=root.document,el=id=>doc.getElementById(id);if(!el('vendor-orders-list'))return;
 let businessId=null,generation=0,orders=null,loading=false,statusKey='';
 const lang=()=>el('owner-preparation-language')?.value||'en',t=key=>(root.DEMEOSVendorCopy?.[lang()]||root.DEMEOSVendorCopy.en)[key];
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 function status(key){statusKey=key;el('vendor-orders-status').textContent=key?t(key):'';el('vendor-orders-list').dataset.state=key||(!orders?'idle':orders.length?'ready':'empty');el('vendor-orders-list').setAttribute('aria-busy',String(key==='loading'));}
 function translate(){if(root.location.hash==='#orders'&&el('owner-area-heading'))el('owner-area-heading').textContent=t('orders');doc.querySelectorAll('[data-vendor-copy]').forEach(n=>{const copy=t(n.dataset.vendorCopy);if(copy){n.textContent=copy;n.lang=lang();n.dir=lang()==='ar'?'rtl':'ltr';}});render();status(statusKey);}
 function render(){const list=el('vendor-orders-list');list.replaceChildren();list.lang=lang();list.dir=lang()==='ar'?'rtl':'ltr';if(!orders)return;if(!orders.length){list.append(node('p',t('ordersEmpty')));return;}list.append(node('p',t('ordersRecent')));for(const order of orders){const card=node('article','');card.className='vendor-order-row';card.append(node('h3',order.line.name),node('p',t('orderReference')+': '+order.id));card.append(node('p',Object.entries(order.line.selection).map(([key,value])=>key+': '+value).join(' · ')));card.append(node('p',t('quantity')+': '+order.line.quantity),node('p',t(order.state==='reserved'?'reserved':order.state==='cancelled'?'cancelledOrder':'expiredOrder')));const money=new Intl.NumberFormat(lang(),{style:'currency',currency:order.line.currency});card.append(node('p',t('unitPrice')+': '+money.format(order.line.unitPriceMinor/10**order.line.currencyDigits)),node('p',t('totalPrice')+': '+money.format(order.line.totalPriceMinor/10**order.line.currencyDigits)));list.append(card);}}
 function active(){const state=root.DEMEOSOwnerWorkspace.getState(doc);return !el('owner-authenticated-workspace')?.hidden&&state.status==='ready'&&state.model==='selling'&&state.businessId===businessId;}
 async function load(){
  if(!businessId||!active()||loading)return;
  const token=generation,selected=businessId;loading=true;orders=null;render();status('loading');el('vendor-orders-reload').disabled=true;
  try{
   const response=await root.fetch('/api/businesses/'+encodeURIComponent(selected)+'/orders',{credentials:'same-origin',cache:'no-store'});
   if(token!==generation||!active())return;
   if(!response.ok){
    let key=response.status===401?'ordersAuth':response.status===403?'ordersDenied':'ordersError';
    if(response.status===403){const denial=await response.json().catch(()=>({}));if(token!==generation||!active())return;if(denial.reason==='application-access-required'&&['pending','submitted','reviewed','changes-requested'].includes(denial.applicationStatus))key='ordersPending';}
    status(key);return;
   }
   const data=await response.json();if(token!==generation||!active())return;
   if(data.businessId!==selected||!Array.isArray(data.orders))throw Error('Invalid business orders');
   orders=data.orders;render();status('');
  }catch(_){if(token===generation&&active()){orders=null;render();status('ordersError');}}
  finally{if(token===generation){loading=false;el('vendor-orders-reload').disabled=false;el('vendor-orders-list').setAttribute('aria-busy','false');}}
 }

 function activate(){const state=root.DEMEOSOwnerWorkspace.getState(doc),next=state.status==='ready'&&state.model==='selling'?state.businessId:null;if(next!==businessId){generation++;businessId=next;orders=null;loading=false;status('');el('vendor-orders-list').replaceChildren();el('vendor-orders-reload').disabled=false;}translate();if(root.location.hash==='#orders')load();}
 doc.addEventListener('owner-model-ready',activate);doc.addEventListener('demeos-owner-auth-changed',activate);root.addEventListener('hashchange',()=>{translate();if(root.location.hash==='#orders')load();});el('vendor-orders-reload').addEventListener('click',load);el('owner-preparation-language')?.addEventListener('change',translate);activate();
 const privateArea=el('owner-authenticated-workspace');if(privateArea)new MutationObserver(()=>{if(privateArea.hidden){generation++;businessId=null;orders=null;loading=false;el('vendor-orders-list').replaceChildren();status('');}}).observe(privateArea,{attributes:true,attributeFilter:['hidden']});
})(typeof window==='undefined'?globalThis:window);
