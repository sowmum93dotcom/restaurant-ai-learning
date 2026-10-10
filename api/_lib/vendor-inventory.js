'use strict';
const {createHash}=require('node:crypto');
const {workspaceReadiness}=require('./business-workspace-readiness');
const key=(productId,variantId='')=>JSON.stringify([productId,variantId]);
function catalogueRevision(profile){return createHash('sha256').update(JSON.stringify(profile)).digest('hex');}
function stockIdentity(product,variant={variantId:''}){
 const selection=Object.entries(variant.selection||{}).sort(([a],[b])=>a.localeCompare(b));
 return createHash('sha256').update(JSON.stringify([product.productId,variant.variantId||'',product.presentation?.categoryId||'',product.presentation?.kind||'product',selection])).digest('hex');
}
function canManage(record,businessId){return ['selling','both'].includes(record?.businessProfile?.preparationModel)&&workspaceReadiness(record,businessId)?.selling?.canPrepare===true;}
function units(value){return Number.isSafeInteger(value)&&value>=0&&value<=1000000000;}
function rowsFor(profile,entries={}){
 return (profile?.products||[]).flatMap(product=>{
  if(product.presentation?.kind==='service')return [];
  const variants=product.presentation?.variants||[];
  // Options without exact variants cannot safely share an inferred balance.
  if(!variants.length&&product.presentation?.options?.length)return [];
  return (variants.length?variants:[{variantId:''}]).map(variant=>{
   const stored=entries[key(product.productId,variant.variantId)]||null;
   const identity=stockIdentity(product,variant),blocked=stored&&stored.identity!==identity,entry=blocked?null:stored;
   const label=variant.selection?Object.entries(variant.selection).map(([field,value])=>product.presentation.options.find(o=>o.key===field)?.values.find(v=>v.value===value)?.label||value).join(' · '):'';
   return {productId:product.productId,variantId:variant.variantId,name:product.name,label,identity,blocked:Boolean(blocked),...(entry?{...entry,available:entry.onHand-entry.reserved,status:entry.onHand-entry.reserved===0?'sold-out':entry.onHand-entry.reserved<=entry.lowStock?'low':'available'}:{onHand:null,reserved:0,available:null,lowStock:5,sku:'',status:'untracked'})};
  });
 });
}
function applyChanges(profile,entries,changes){
 if(!Array.isArray(changes)||!changes.length||changes.length>100)throw Error('Choose between 1 and 100 stock rows.');
 const rows=rowsFor(profile,entries),valid=new Set(rows.map(row=>key(row.productId,row.variantId)));
 const next=structuredClone(entries||{}),seen=new Set(),audit=[];
 for(const change of changes){
  if(!change||typeof change!=='object'||Object.keys(change).some(k=>!['productId','variantId','onHand','lowStock','sku','reason'].includes(k)))throw Error('Check the stock details.');
  const id=key(change.productId,change.variantId);
  if(!valid.has(id)||seen.has(id))throw Error('Reload the current product options before saving.');
  const current=rows.find(row=>key(row.productId,row.variantId)===id);
  if(current.blocked)throw Error('This stock belongs to earlier product options. Restore those options or create a new variant identity.');
  seen.add(id);
  const previous=next[id]||{onHand:null,reserved:0};
  if(!units(change.onHand)||!units(change.lowStock)||typeof change.sku!=='string'||change.sku.trim().length>80||typeof change.reason!=='string'||!change.reason.trim()||change.reason.trim().length>300)throw Error('Use whole quantities and add a short reason for the change.');
  if(change.onHand<previous.reserved)throw Error('Stock cannot be below the quantity reserved for orders.');
  next[id]={identity:current.identity,onHand:change.onHand,reserved:previous.reserved,lowStock:change.lowStock,sku:change.sku.trim()};
  audit.push({identity:current.identity,name:current.name,label:current.label,productId:change.productId,variantId:change.variantId||'',before:previous.onHand,after:change.onHand,previousLowStock:previous.lowStock??null,lowStock:change.lowStock,previousSku:previous.sku||'',sku:change.sku.trim(),reason:change.reason.trim()});
 }
 const skus=new Set();
 for(const [id,entry] of Object.entries(next))if(valid.has(id)&&entry.sku){const sku=entry.sku.toLowerCase();if(skus.has(sku))throw Error('Each stock code must be unique within your business.');skus.add(sku);}
 return {entries:next,audit};
}
module.exports={stockIdentity,key,canManage,units,rowsFor,applyChanges,catalogueRevision};
