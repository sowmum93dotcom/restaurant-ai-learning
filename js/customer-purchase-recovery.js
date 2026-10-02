/* One-tab retry reference only. No identity, fulfilment details or payment proof. */
(function(root){
 'use strict';
 const contract=typeof module!=='undefined'&&module.exports?require('./customer-purchase-preparation-contract'):root.DEMEOSPurchasePreparationContract;
 const key='demeos-controlled-checkout-retry-v1';
 function tag(draft,now){
  const d=contract.draft(draft,now);if(!d)return null;
  return JSON.stringify([d.workItemId,d.productId,d.quantity,Object.entries(d.selection).sort(([a],[b])=>a.localeCompare(b))]);
 }
 function clear(storage){try{storage.removeItem(key);}catch(_){} }
 function nonce(storage,draft,makeId,now=Date.now()){
  const selected=tag(draft,now);if(!selected)return null;
  try{
   const stored=JSON.parse(storage.getItem(key)||'null');
   if(stored&&Object.keys(stored).sort().join(',')==='expires,id,selection'&&stored.selection===selected&&typeof stored.id==='string'&&/^[a-zA-Z0-9-]{16,100}$/.test(stored.id)&&Number.isFinite(stored.expires)&&stored.expires>now&&stored.expires<=now+3600000)return stored.id;
   const id=makeId();if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(id))return null;
   storage.setItem(key,JSON.stringify({id,selection:selected,expires:Math.min(draft.expires,now+1800000)}));return id;
  }catch(_){return null;}
 }
 const api=Object.freeze({nonce,clear});if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DEMEOSCheckoutRecovery=api;
})(typeof window!=='undefined'?window:{});
