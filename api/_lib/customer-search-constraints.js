'use strict';
// Additional hard checks use only the existing validated public projection.
// Unknown support is never represented as requirement satisfaction.
function terms(text){return new Set(String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);}
function positiveFact(text,value){
  if(!terms(text).has(value))return false;
  const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return !new RegExp('\\b(?:not|no|without)\\s+(?:a\\s+|any\\s+)?'+escaped+'\\b','i').test(text);
}
function meetsBudget(pricing,budget){
  if(!budget)return true;
  if(!pricing||pricing.currency!==budget.currency||!['fixed','range'].includes(pricing.mode))return false;
  const maximum=pricing.mode==='range'?pricing.max:pricing.amount;
  return Number.isFinite(maximum)&&(budget.inclusive?maximum<=budget.maximum:maximum<budget.maximum);
}
function legacyPrice(product){
  const m=/^(£|€|GBP\s*|EUR\s*|USD\s*)\s*(\d+(?:\.\d{1,2})?)$/i.exec(product.price || '');
  return m&&product.priceMode==='fixed'?{mode:'fixed',currency:/^(£|GBP)/i.test(m[1])?'GBP':/^(€|EUR)/i.test(m[1])?'EUR':'USD',amount:Number(m[2])}:null;
}
function productSatisfies(product,intention){
  if(intention.requireAvailability&&!['available','limited'].includes(product.availability))return false;
  const evidence=terms(product.name+' '+product.description);
  if(intention.exclusions.some(value=>evidence.has(value)))return false;
  if(!intention.mustHave.every(value=>positiveFact(product.name+' '+product.description,value)))return false;
  if(!meetsBudget(product.presentation?.pricing || legacyPrice(product),intention.budget))return false;
  if(intention.budget&&product.presentation?.variants.some(v=>v.availability!=='unavailable'&&!meetsBudget(v.pricing,intention.budget)))return false;
  return true;
}
function constrainPossibility(possibility,intention){
  // There is no authoritative date/stock/capacity/distance contract in the
  // present public catalogue. Preserve the extracted requirement and fail closed.
  if(intention.ambiguity.length)return {accepted:false,reason:'clarification_required'};
  if(intention.date||intention.time||intention.distance||intention.quantity||intention.partySize)return {accepted:false,reason:'requirement_not_verifiable'};
  if(intention.location&&String(possibility.location || '').normalize('NFKC').toLowerCase()!==intention.location.normalize('NFKC').toLowerCase())return {accepted:false,reason:'location_requirement'};
  if(!intention.budget&&!intention.mustHave.length&&!intention.requireAvailability)return {accepted:true,possibility};
  const products=(possibility.products || []).filter(product=>productSatisfies(product,intention));
  if(products.length)return {accepted:true,possibility:{...possibility,products}};
  if(!intention.budget&&(!intention.requireAvailability||['available','limited'].includes(possibility.operationalAvailability?.status))&&intention.mustHave.every(value=>positiveFact(possibility.content,value)))return {accepted:true,possibility};
  return {accepted:false,reason:'hard_requirement_not_supported'};
}
module.exports={constrainPossibility,productSatisfies,meetsBudget};
