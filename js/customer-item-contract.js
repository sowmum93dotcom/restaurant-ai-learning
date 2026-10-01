/* AREA 1 receiving contract. Shared by public APIs and Customer Experience. */
(function (root) {
  'use strict';
  const categories = Object.freeze({
    'fashion.apparel': {parent:'fashion',kind:'product',fields:['size','colour']},
    'groceries.packs': {parent:'groceries',kind:'product',fields:['weight','quantity','packSize']},
    'sports.sessions': {parent:'sports',kind:'service',fields:['duration','location','people','date']},
    'outdoors.experiences': {parent:'outdoors',kind:'service',fields:['duration','location','people','date']},
    'family.toys': {parent:'family',kind:'product',fields:[]},
    'services.appointments': {parent:'services',kind:'service',fields:['duration','location','people','date']}
  });
  const valueCopy = Object.freeze({size:['extraSmall','small','medium','large','extraLarge','extraExtraLarge'],colour:['black','blue','pink'],weight:['weight500','weight1000'],quantity:['quantity1','quantity2'],packSize:['pack1','pack2'],duration:['minutes30','minutes60'],location:['testVenue','customerLocation'],people:['onePerson','twoPeople'],date:[]});
  const states = ['available','limited','unavailable','contact'];
  const currencies = new Set(['GBP','EUR','USD','JPY','CNY','INR','BRL','CAD','AUD','CHF','NZD','ZAR','NGN','GHS','GNF','XOF','XAF','AED','SAR','TRY','KRW','SGD','HKD','MXN','SEK','NOK','DKK','PLN']);
  const object = x => x && typeof x==='object' && !Array.isArray(x);
  const string = x => typeof x==='string' && x.trim().length>0 && x.trim().length<=120;
  const money = x => typeof x==='number' && Number.isFinite(x) && x>=0 && x<=1e12;
  function pricing(value) {
    if(!object(value))return null;
    if(['none','quote'].includes(value.mode))return {mode:value.mode};
    if(!currencies.has(value.currency))return null;
    if(['fixed','from'].includes(value.mode)&&money(value.amount))return {mode:value.mode,currency:value.currency,amount:value.amount};
    if(value.mode==='range'&&money(value.min)&&money(value.max)&&value.max>=value.min)return {mode:'range',currency:value.currency,min:value.min,max:value.max};
    return null;
  }
  function normalize(value) {
    if(!object(value)||!Object.hasOwn(categories,value.categoryId))return null;
    const category=categories[value.categoryId],price=pricing(value.pricing);
    if(!price)return null;
    const options=[];
    if(value.options!==undefined&&!Array.isArray(value.options))return null;
    if((value.options||[]).length>category.fields.length)return null;
    for(const field of value.options||[]) {
      if(!object(field)||!category.fields.includes(field.key)||options.some(o=>o.key===field.key)||!Array.isArray(field.values)||!field.values.length||field.values.length>100)return null;
      const values=[];
      for(const choice of field.values) {
        if(!object(choice)||!string(choice.value)||!string(choice.label)||values.some(v=>v.value===choice.value))return null;
        if(choice.copyKey!==undefined&&!valueCopy[field.key].includes(choice.copyKey))return null;
        values.push({value:choice.value,label:choice.label,...(choice.copyKey?{copyKey:choice.copyKey}:{})});
      }
      options.push({key:field.key,values});
    }
    const variants=[],signatures=new Set(),ids=new Set();
    if(value.variants!==undefined&&!Array.isArray(value.variants))return null;
    if((value.variants||[]).length>500)return null;
    for(const variant of value.variants||[]) {
      if(!options.length||!object(variant)||!string(variant.variantId)||ids.has(variant.variantId)||!object(variant.selection)||Object.keys(variant.selection).length!==options.length||!states.includes(variant.availability))return null;
      const selection={};
      for(const option of options) {
        if(!option.values.some(v=>v.value===variant.selection[option.key]))return null;
        selection[option.key]=variant.selection[option.key];
      }
      const signature=JSON.stringify(selection);
      if(signatures.has(signature))return null;
      signatures.add(signature);ids.add(variant.variantId);
      const variantPrice=variant.pricing===undefined?price:pricing(variant.pricing);
      if(!variantPrice)return null;
      variants.push({variantId:variant.variantId,selection,availability:variant.availability,pricing:variantPrice});
    }
    return {version:1,categoryId:value.categoryId,kind:category.kind,pricing:price,options,variants};
  }
  function resolve(presentation,baseAvailability,selection={}) {
    const complete=presentation.options.every(o=>o.values.some(v=>v.value===selection[o.key]));
    if(!complete)return {availability:baseAvailability==='unavailable'?'unavailable':'selection-required',pricing:presentation.pricing,canContinue:false};
    const variant=presentation.variants.length?presentation.variants.find(v=>presentation.options.every(o=>v.selection[o.key]===selection[o.key])):null;
    const unavailable=baseAvailability==='unavailable'||(presentation.variants.length&&!variant);
    const availability=unavailable?'unavailable':variant?variant.availability:states.includes(baseAvailability)?baseAvailability:'contact';
    return {availability,pricing:variant?variant.pricing:presentation.pricing,canContinue:availability!=='unavailable',variantId:variant?variant.variantId:null};
  }
  const api=Object.freeze({categories,pricing,normalize,resolve});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.DEMEOSCustomerItemContract=api;
}(typeof window!=='undefined'?window:{}));
