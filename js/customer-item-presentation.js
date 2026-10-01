/* Reusable AREA 1 item rendering. Language selection/storage stays in the existing controller. */
(function(root){
 'use strict';
 const contract=root.DEMEOSCustomerItemContract;
 let active=null;
 const locale=()=>root.document.documentElement.lang||'en';
 const copy=()=>root.DEMEOSItemPresentationCopy[locale()]||root.DEMEOSItemPresentationCopy.en;
 const baseCopy=()=>root.DEMEOSProductExperienceCopy[locale()]||root.DEMEOSProductExperienceCopy.en;
 function set(node,value){if(node&&node.textContent!==value)node.textContent=value;}
 function node(doc,parent,tag,cls){const n=doc.createElement(tag);n.className=cls;parent.appendChild(n);return n;}
 function currency(amount,code){return new Intl.NumberFormat(locale(),{style:'currency',currency:code}).format(amount);}
 function price(value){
  if(value.mode==='none')return '';
  if(value.mode==='quote')return copy().quote;
  if(value.mode==='fixed')return currency(value.amount,value.currency);
  if(value.mode==='from')return baseCopy().from.replace('{price}',currency(value.amount,value.currency));
  return baseCopy().range.replace('{price}',currency(value.min,value.currency)+' – '+currency(value.max,value.currency));
 }
 function choiceLabel(field,value){
  if(field.key==='size'&&({extraSmall:'XS',small:'S',medium:'M',large:'L',extraLarge:'XL',extraExtraLarge:'XXL'})[value.value])return ({extraSmall:'XS',small:'S',medium:'M',large:'L',extraLarge:'XL',extraExtraLarge:'XXL'})[value.value];
  if(value.copyKey)return copy().values[value.copyKey];
  if(field.key==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value.value)){
   const date=new Date(value.value+'T12:00:00Z');
   if(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.value)return new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeZone:'UTC'}).format(date);
  }
  return value.label;
 }
 function availability(state,kind){
  if(state==='selection-required')return copy().selectionRequired;
  if(kind==='service')return copy()[{available:'serviceAvailable',limited:'serviceLimited',unavailable:'serviceUnavailable',contact:'serviceContact'}[state]||'serviceContact'];
  return baseCopy()[{available:'available',limited:'limited',unavailable:'unavailable',contact:'contactAvailability'}[state]||'contactAvailability'];
 }
 function mountCard(doc,card,product){
  if(!product.presentation)return;
  card.setAttribute('data-structured-item','true');
  card.demeosProduct=product;
  // External continuation belongs only to the resolved selection surface.
  card.querySelectorAll('a').forEach(link=>{
   const destination=link.getAttribute('href')||'';
   if(/^https:\/\//i.test(destination))link.setAttribute('data-customer-destination',destination);
   link.setAttribute('href','#product-experience');
   link.removeAttribute('target');link.removeAttribute('rel');
   if(link.classList.contains('customer-product-continue-action')){
    const button=doc.createElement('button');button.type='button';button.className=link.className;
    button.textContent=link.textContent;
    if(link.hasAttribute('data-customer-destination'))button.setAttribute('data-customer-destination',destination);
    link.replaceWith(button);
   }
  });

  if(!card.querySelector('.customer-item-category'))node(doc,card,'p','customer-item-category');
  if(!card.querySelector('.customer-discover-option-price, .customer-product-price'))node(doc,card,'p','customer-discover-option-price');
  if(!card.querySelector('.customer-discover-option-availability, .customer-product-availability'))node(doc,card,'p','customer-discover-option-availability');
  if(!card.querySelector('.customer-product-continue-action')){
   const button=node(doc,card,'button','customer-item-details');button.type='button';
  }
  renderCard(card);
 }
 function renderCard(card){
  const product=card.demeosProduct,p=product&&product.presentation;
  if(!p)return;
  set(card.querySelector('.customer-item-category'),copy().categories[p.categoryId]);
  const priceNode=card.querySelector('.customer-discover-option-price, .customer-product-price');
  set(priceNode,price(p.pricing));priceNode.hidden=p.pricing.mode==='none';
  set(card.querySelector('.customer-discover-option-availability, .customer-product-availability'),availability(product.availability,p.kind));
  set(card.querySelector('.customer-item-details'),copy().viewDetails);
  set(card.querySelector('.customer-product-continue-action'),product.continuationRoute==='demeos'?copy().buyDemeos:product.continuationRoute==='booking'?root.DEMEOSControlledCustomerCopy[locale()].book:root.DEMEOSControlledCustomerCopy[locale()].buy);
 }
 function open(doc,surface,product,destination,work){
  const container=doc.getElementById('product-experience-options');
  if(!container)return;
  container.replaceChildren();container.hidden=true;
  const presentation=product.presentation;
  active=null;
  if(!presentation)return;
  active={doc,surface,product,destination,work,selection:{}};
  container.hidden=!presentation.options.length;
  const legend=node(doc,container,'legend','customer-item-options-title');
  legend.id='product-experience-options-title';
  for(const field of presentation.options){
   const label=node(doc,container,'label','customer-item-option');
   label.setAttribute('data-option-key',field.key);
   node(doc,label,'span','customer-item-option-label');
   const select=node(doc,label,'select','customer-item-option-select');
   select.setAttribute('data-option-key',field.key);
   if(field.values.length===1){active.selection[field.key]=field.values[0].value;select.disabled=true;}
   else{const placeholder=node(doc,select,'option','customer-item-option-placeholder');placeholder.value='';}
   for(const value of field.values){const option=node(doc,select,'option','');option.value=value.value;}
   select.value=active.selection[field.key]||'';
   select.addEventListener('change',()=>{if(!active||active.surface!==surface)return;active.selection[field.key]=select.value;renderSurface();});
  }
  renderSurface();
 }
 function renderSurface(){
  if(!active)return;
  const {doc,surface,product,destination,selection}=active,p=product.presentation;
  if(surface.hidden)return;
  const state=contract.resolve(p,product.availability,selection),c=copy();
  const category=doc.getElementById('product-experience-category');
  set(category,c[p.kind]+' · '+c.categories[p.categoryId]);category.hidden=false;
  const priceNode=doc.getElementById('product-experience-price');set(priceNode,price(state.pricing));priceNode.hidden=state.pricing.mode==='none';
  set(doc.getElementById('product-experience-availability'),availability(state.availability,p.kind));
  set(doc.getElementById('product-experience-options-title'),c.choose);
  for(const field of p.options){
   const label=doc.querySelector('#product-experience-options label[data-option-key="'+field.key+'"]');
   set(label.querySelector('span'),c.fields[field.key]);
   const select=label.querySelector('select');
   for(const option of select.options){const value=field.values.find(v=>v.value===option.value);set(option,value?choiceLabel(field,value):c.select);}
  }
  const summary=doc.getElementById('product-experience-selection');
  const selected=p.options.filter(o=>selection[o.key]).map(o=>c.fields[o.key]+': '+choiceLabel(o,o.values.find(v=>v.value===selection[o.key])));
  set(summary,selected.length?c.selectionSummary+': '+selected.join(' · '):'');summary.hidden=!selected.length;
  const action=doc.getElementById('product-experience-action');
  action.hidden=false;action.removeAttribute('href');action.setAttribute('aria-disabled','true');
  if(product.continuationRoute==='demeos'){
   const preparable=state.canContinue&&['available','limited'].includes(state.availability)&&surface.getAttribute('data-controlled-test')==='true'&&root.DEMEOSCustomerPurchasePreparation;
   set(action,preparable?root.DEMEOSPurchasePreparationCopy[locale()].continue:state.canContinue?c.demeosInactive:availability(state.availability,p.kind));
   if(preparable){action.href='#purchase-preparation';action.removeAttribute('aria-disabled');}
  }else if(!state.canContinue){
   set(action,state.availability==='selection-required'?c.selectionRequired:p.variants.length&&state.variantId===null?c.missingCombination:availability(state.availability,p.kind));
  }else{
   set(action,product.continuationRoute==='booking'?root.DEMEOSControlledCustomerCopy[locale()].book:root.DEMEOSControlledCustomerCopy[locale()].buy);
   if(/^https:\/\//i.test(destination)){action.href=destination;action.removeAttribute('aria-disabled');}
  }
  const guidance=doc.getElementById('product-experience-selection-guidance');
  set(guidance,p.options.length&&product.continuationRoute!=='demeos'?c.confirmBusiness:'');guidance.hidden=!p.options.length||product.continuationRoute==='demeos';
  if(root.DEMEOSCustomerPurchasePreparation)root.DEMEOSCustomerPurchasePreparation.product(active);
  surface.setAttribute('data-selected-availability',state.availability);
  surface.setAttribute('data-selected-variant',state.variantId||'');
 }
 function selection(values){if(!active)return;active.selection={...values};for(const select of active.doc.querySelectorAll('#product-experience-options select'))select.value=values[select.getAttribute('data-option-key')]||'';renderSurface();}
 function snapshot(){return active;}
 function localize(){root.document.querySelectorAll('[data-structured-item]').forEach(renderCard);renderSurface();}
 function reset(doc){active=null;['product-experience-category','product-experience-options','product-experience-selection','product-experience-selection-guidance'].forEach(id=>{const n=doc.getElementById(id);if(n)n.hidden=true;});}
 root.DEMEOSCustomerItemPresentation=Object.freeze({mountCard,open,localize,reset,price,choiceLabel,selection,snapshot});
}(typeof window!=='undefined'?window:{}));
