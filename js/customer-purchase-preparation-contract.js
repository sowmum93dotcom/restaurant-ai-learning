/* Controlled, non-transactional AREA 1 preparation. No order or payment authorization. */
(function(root){
 'use strict';
 const items=typeof module!=='undefined'&&module.exports?require('./customer-item-contract'):root.DEMEOSCustomerItemContract;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const id=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{1,200}$/.test(x);
 function draft(value,now=Date.now()){
  if(!object(value)||Object.keys(value).some(k=>!['version','workItemId','productId','selection','quantity','expires'].includes(k))||value.version!==1||!id(value.workItemId)||!id(value.productId)||!object(value.selection)||!Number.isSafeInteger(value.quantity)||value.quantity<1||value.quantity>20||!Number.isFinite(value.expires)||value.expires<=now||value.expires>now+3600000)return null;
  if(Object.keys(value.selection).length>9||Object.entries(value.selection).some(([k,v])=>!['size','colour','weight','quantity','packSize','duration','location','people','date'].includes(k)||typeof v!=='string'||!v||v.length>120))return null;
  return {version:1,workItemId:value.workItemId,productId:value.productId,selection:{...value.selection},quantity:value.quantity,expires:value.expires};
 }
 function resolve(work,value,now=Date.now()){
  const d=draft(value,now);if(!d)return {ready:false,reason:'invalid'};
  const business=Array.isArray(work)&&work.find(w=>w.workItemId===d.workItemId);
  const product=business&&business.products&&business.products.find(p=>p.productId===d.productId);
  if(!product||product.continuationRoute!=='demeos'||!business.customerContinuation?.routes.includes('demeos')||!product.presentation)return {ready:false,reason:'invalid'};
  const presentation=items.normalize(product.presentation);if(!presentation)return {ready:false,reason:'invalid'};
  if(Object.keys(d.selection).length!==presentation.options.length||Object.keys(d.selection).some(k=>!presentation.options.some(o=>o.key===k)))return {ready:false,reason:'invalid'};
  const state=items.resolve(presentation,product.availability,d.selection);
  const modes=product.fulfilment?.methods||[];
  const method=modes.length===1&&['delivery','collection','appointment','digital'].includes(modes[0])?modes[0]:null;
  if(!method||!state.canContinue||!['available','limited'].includes(state.availability))return {ready:false,reason:'unavailable'};
  if((presentation.kind==='service'||product.fulfilment.quantityEnabled!==true||presentation.options.some(o=>o.key==='quantity'))&&d.quantity!==1)return {ready:false,reason:'invalid'};
  return {ready:true,draft:d,business,product:{...product,presentation},state,method};
 }
 function fields(preparation){
  const allowed=preparation.method==='delivery'?['recipient','address','city','postalCode','country']:preparation.method==='appointment'?['date','location','people']:[];
  return (preparation.product.fulfilment.requiredDetails||[]).filter(k=>allowed.includes(k)&&!preparation.product.presentation.options.some(o=>o.key===k));
 }
 function validDetails(preparation,details){
  if(!object(details)||Object.keys(details).some(k=>!fields(preparation).includes(k)))return false;
  return fields(preparation).every(k=>{
   const v=details[k];if(typeof v!=='string'||!v.trim()||v.length>200)return false;
   if(k==='people')return /^[1-9]\d?$/.test(v);
   if(k==='date'){const date=new Date(v+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;}
   return true;
  });
 }
 const api=Object.freeze({draft,resolve,fields,validDetails});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.DEMEOSPurchasePreparationContract=api;
}(typeof window!=='undefined'?window:{}));
