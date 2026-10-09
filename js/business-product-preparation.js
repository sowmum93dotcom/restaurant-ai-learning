/* Owner authoring adapter for the existing customer item contract. */
(function(root){
 'use strict';
 const contract=typeof module==='object'&&module.exports?require('./customer-item-contract'):root.DEMEOSCustomerItemContract;
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Only retained server data supplies unknown extensions. Incoming supported fields
 // have already passed the existing contract; omissions must not erase options.
 function preserveProduct(previous,incoming){
  const next={...(previous||{}),...incoming};
  // Omitting this supported override explicitly restores business defaults.
  // Retain unknown extensions, but do not restore a cleared fulfilment choice.
  if(!Object.hasOwn(incoming,'fulfilment'))delete next.fulfilment;
  if(!previous?.presentation)return next;
  if(!incoming.presentation){next.presentation=clone(previous.presentation);return next;}
  const old=previous.presentation,value=incoming.presentation;
  if(old.categoryId!==value.categoryId&&(old.options?.length||old.variants?.length))throw Error('Keep the category for an offer with recorded options.');
  next.presentation={...old,...value,pricing:{...old.pricing,...value.pricing},
   options:value.options.map(option=>{const prior=old.options?.find(o=>o.key===option.key);return {...prior,...option,values:option.values.map(choice=>({...prior?.values?.find(v=>v.value===choice.value),...choice}))};}),
   variants:value.variants.map(variant=>{const prior=old.variants?.find(v=>v.variantId===variant.variantId);return {...prior,...variant,pricing:{...prior?.pricing,...variant.pricing}};})};
  return next;
 }
 function priceText(price){
  const p=contract.pricing(price);if(!p)return '';
  if(p.mode==='none')return 'No listed price';
  if(p.mode==='quote')return 'Contact the business for pricing';
  const number=n=>String(n)+' '+p.currency;
  return p.mode==='range'?number(p.min)+' – '+number(p.max):(p.mode==='from'?'From ':'')+number(p.amount);
 }
 const categoryNames={'fashion.apparel':'Clothing','groceries.packs':'Grocery packs','sports.sessions':'Sports sessions','outdoors.experiences':'Outdoor experiences','family.toys':'Toys','services.appointments':'Appointments and services'};
 function createEditor(document){
  const category=document.getElementById('owner-product-category'),panel=document.getElementById('owner-product-options');
  if(!category||!panel)return null;
  let current=null;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const input=(label,value,type='text')=>{const wrap=el('label',label),field=el('input');field.type=type;field.value=value??'';field.maxLength=120;if(type==='number'){field.min='0';field.step='any';}wrap.append(field);return {wrap,field};};
  const optionSelect=(label,values,chosen)=>{const wrap=el('label',label),field=el('select');field.setAttribute('aria-label',label);for(const [value,text] of values){const o=el('option',text);o.value=value;field.append(o);}field.value=chosen;wrap.append(field);return {wrap,field};};
  const empty=el('option','General product or service');empty.value='';empty.dataset.ownerCopy='generalCategory';category.append(empty);
  const copyNode=(tag,key,text)=>{const node=el(tag,text);node.dataset.ownerCopy=key;return node;};
  for(const id of Object.keys(contract.categories)){const o=el('option',categoryNames[id]);o.value=id;o.dataset.ownerCategory=id;category.append(o);}
  let basePrice=null,choices=[],variants=[];
  function readOptions(){return choices.map(row=>{const values=row.fields.map(entry=>({...entry.choice,label:entry.field.value.trim()}));
   for(const label of row.add.value.split('\n').map(s=>s.trim()).filter(Boolean))values.push({value:label,label});
   return values.length?{...row.option,key:row.key,values}:null;}).filter(Boolean);}
  function refreshVariantChoices(){const options=readOptions();for(const row of variants)for(const choice of row.selection){const option=options.find(o=>o.key===choice.key),selected=choice.field.value;choice.field.textContent='';const empty=el('option','Choose an option');empty.value='';choice.field.append(empty);for(const value of option?.values||[]){const node=el('option',value.label);node.value=value.value;choice.field.append(node);}choice.field.value=option?.values.some(v=>v.value===selected)?selected:'';choice.field.disabled=!option;choice.field.parentElement.hidden=!option;}}
  function priceControls(price){
   const p=price||{mode:'quote'},box=el('div');box.className='owner-price-controls';
   const mode=optionSelect('Pricing',[['quote','Contact for price'],['none','No listed price'],['fixed','Fixed price'],['from','From price'],['range','Price range']],p.mode);
   const currency=input('Currency',p.currency||'GBP'),amount=input('Amount',p.amount,'number'),min=input('Minimum',p.min,'number'),max=input('Maximum',p.max,'number');currency.field.maxLength=3;
   box.append(mode.wrap,currency.wrap,amount.wrap,min.wrap,max.wrap);
   function visibility(){const money=!['none','quote'].includes(mode.field.value);currency.wrap.hidden=!money;amount.wrap.hidden=!money||mode.field.value==='range';min.wrap.hidden=max.wrap.hidden=mode.field.value!=='range';}
   mode.field.addEventListener('change',visibility);visibility();
   return {box,read(){const modeValue=mode.field.value,number=f=>f.value.trim()===''?NaN:Number(f.value);return ['quote','none'].includes(modeValue)?{mode:modeValue}:{mode:modeValue,currency:currency.field.value.trim().toUpperCase(),...(modeValue==='range'?{min:number(min.field),max:number(max.field)}:{amount:number(amount.field)})};}};
  }
  function render(){
   panel.textContent='';choices=[];variants=[];panel.hidden=!category.value;
   const cat=contract.categories[category.value];
   const hint=document.getElementById('owner-category-guidance');if(hint){hint.dataset.ownerCopy=cat?'categoryGuidance':'generalGuidance';}
   if(!cat){basePrice=null;root.DEMEOSBusinessPreparationLanguage?.apply(document.getElementById('owner-preparation-language')?.value);return;}
   basePrice=priceControls(current?.pricing);panel.append(basePrice.box);
   if(cat.fields.length)panel.append(copyNode('p','optionalChoices','Available options are optional. Add only choices you actually offer; leave other fields empty.'));
   for(const key of cat.fields){
    const option=current?.options?.find(o=>o.key===key),box=el('fieldset'),legend=el('legend',key==='packSize'?'Pack size':key[0].toUpperCase()+key.slice(1));legend.dataset.ownerField=key;box.append(legend);
    const fields=(option?.values||[]).map(choice=>{const entry=input('Label',choice.label);entry.field.dataset.optionValue=choice.value;entry.field.addEventListener('input',refreshVariantChoices);box.append(entry.wrap);return {choice,field:entry.field};});
    const add=input('Available choices (one per line)','');add.wrap.dataset.ownerChoiceLabel='true';const textarea=el('textarea');textarea.rows=2;textarea.maxLength=12000;textarea.addEventListener('input',refreshVariantChoices);add.field.replaceWith(textarea);box.append(add.wrap);panel.append(box);choices.push({key,option,fields,add:textarea});
   }
   const combinations=el('details');combinations.className='owner-combinations';combinations.open=Boolean(current?.variants?.length);combinations.append(copyNode('summary','specificOptions','Specific options and prices (optional)'),copyNode('p','combinationsGuidance','Use this only when a particular combination has its own price or availability. Saved combinations are kept exactly; DEMEOS does not create combinations for you.'));const list=el('div');combinations.append(list);if(cat.fields.length)panel.append(combinations);
   function addVariant(variant,isNew){const box=el('fieldset');box.className='owner-variant';box.append(el('legend',isNew?'New combination':Object.entries(variant.selection).map(([key,value])=>current?.options?.find(o=>o.key===key)?.values.find(v=>v.value===value)?.label||value).join(' · ')));
    const selection=[];for(const key of cat.fields.filter(key=>isNew||!Object.hasOwn(variant.selection,key))){const option=readOptions().find(o=>o.key===key),field=optionSelect(key[0].toUpperCase()+key.slice(1)+' choice',[['','Choose an option'],...(option?.values||[]).map(v=>[v.value,v.label])],variant.selection[key]||'');field.wrap.hidden=!option;field.field.disabled=!option;box.append(field.wrap);selection.push({key,field:field.field});}
    const status=optionSelect('Availability',[['available','Available'],['limited','Limited availability'],['unavailable','Unavailable'],['contact','Contact to confirm']],variant.availability),price=priceControls(variant.pricing||current?.pricing);box.append(status.wrap,price.box);list.append(box);variants.push({variant,status:status.field,price,selection});
   }
   for(const variant of current?.variants||[])addVariant(variant,false);
   if(cat.fields.length){const add=copyNode('button','addCombination','Add a specific combination'),message=el('p');add.type='button';add.className='text-button';message.setAttribute('role','status');combinations.append(add,message);
    add.addEventListener('click',()=>{const options=readOptions();if(!options.length||variants.length>=500){message.textContent='Add choices above first. Up to 500 combinations are supported.';return;}
     addVariant({variantId:'variant-'+(root.crypto?.randomUUID?.()||Date.now()+'-'+variants.length),selection:Object.fromEntries(options.map(o=>[o.key,''])),availability:'contact',pricing:basePrice.read()},true);message.textContent='Choose a unique combination, then confirm its price and availability.';});
   }
   root.DEMEOSBusinessPreparationLanguage?.apply(document.getElementById('owner-preparation-language')?.value);
  }
  function load(product){current=product?.presentation?clone(product.presentation):null;empty.disabled=Boolean(current);category.value=current?.categoryId||'';category.disabled=Boolean(current?.options?.length||current?.variants?.length);render();}
  category.addEventListener('change',()=>{const pricing=basePrice?.read();current=category.value&&pricing?{...(current||{}),categoryId:category.value,pricing,options:[],variants:[]}:null;render();});
  return {load,read(){
   if(!category.value)return undefined;
   const options=readOptions();
   const candidate={...(current||{}),categoryId:category.value,pricing:basePrice.read(),options,variants:variants.map(row=>({...row.variant,...(row.selection.length?{selection:{...row.variant.selection,...Object.fromEntries(row.selection.filter(s=>options.some(o=>o.key===s.key)).map(s=>[s.key,s.field.value]))}}:{}),availability:row.status.value,pricing:row.price.read()}))};
   if(!contract.normalize(candidate))throw Error('Check option labels, unique choices, currency and prices. Prices must be zero or more; the maximum must not be below the minimum.');
   return {...candidate,kind:contract.categories[category.value].kind,version:1};
  }};
 }
 const api={preserveProduct,priceText,createEditor};if(typeof module==='object'&&module.exports)module.exports=api;root.DEMEOSBusinessProductPreparation=api;
}(typeof window==='object'?window:{}));
