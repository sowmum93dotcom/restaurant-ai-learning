(function(root){
 'use strict';
 function parseCsv(text){
  if(typeof text!=='string'||text.length>1000000)throw Error('CSV is too large.');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
   else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
  if(quoted)throw Error('Close each quoted field.');row.push(field);if(row.some(Boolean))rows.push(row);
  if(rows.length>10001)throw Error('Too many rows.');return rows;
 }
 const csvCell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
 if(typeof module!=='undefined'&&module.exports){module.exports={parseCsv,csvCell};return;}
 const doc=root.document,el=id=>doc.getElementById(id),copy=root.DEMEOSVendorCopy;
 let context=null,generation=0,loadSerial=0,stock=null,pending=new Map(),catalogue=null,busy=false;
 let language=el('owner-preparation-language')?.value||'en';
 const t=key=>copy[language]?.[key]||copy.en[key]||key;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const input=(label,value,type='text')=>{const wrap=node('label'),span=node('span',label),field=node('input');field.type=type;field.value=value??'';if(type==='number'){field.min='0';field.step='1';field.max='1000000000';}wrap.append(span,field);return {wrap,field};};
 function translate(){language=el('owner-preparation-language')?.value||'en';doc.querySelectorAll('[data-vendor-copy]').forEach(n=>{n.textContent=t(n.dataset.vendorCopy);n.lang=language;n.dir=language==='ar'?'rtl':'ltr';});if(stock)render();compactCatalogue();if(root.DEMEOSOwnerWorkspace?.getState(doc).model==='selling')root.DEMEOSVendorProducts?.refreshMedia();}
 function status(message){el('vendor-stock-status').textContent=message;}
 function active(){const current=root.DEMEOSOwnerWorkspace?.getState(doc);return context&&current?.model==='selling'&&current.businessId===context&&current.status==='ready';}
 function url(resource){return '/api/businesses/'+encodeURIComponent(context)+'/'+resource;}
 async function request(resource,options={}){const response=await fetch(url(resource),{credentials:'same-origin',...options});const data=await response.json();if(!response.ok){const error=Error(response.status===409?t('conflict'):t('error'));if(language==='en'&&data.error)error.message=data.error;error.status=response.status;throw error;}return data;}
 function reset(){generation++;context=null;stock=null;catalogue=null;pending.clear();busy=false;el('products').inert=false;el('vendor-stock-list').inert=false;el('vendor-stock-search').disabled=false;el('vendor-stock-filter').disabled=false;el('vendor-stock-import').disabled=false;el('vendor-stock-list').replaceChildren();el('vendor-stock-summary').replaceChildren();el('vendor-stock-history').replaceChildren();el('vendor-stock-review').hidden=true;status('');el('vendor-products-status').textContent='';el('vendor-products-confirm').checked=false;el('vendor-stock-search').value='';el('vendor-stock-reason').value='';el('vendor-stock-filter').value='all';el('vendor-stock-save').disabled=true;el('vendor-products-save').disabled=true;}
 async function load(force=false){
  if(!active()||busy)return;
  if(pending.size&&!force){status(t('changed'));return;}
  const token=generation,serial=++loadSerial,businessId=context;status(t('loading'));busy=true;el('vendor-stock-save').disabled=true;
  try{const data=await request('inventory');if(token!==generation||serial!==loadSerial||businessId!==context||!active())return;stock=data;pending.clear();render();status('');}
  catch(error){if(token!==generation)return;if([401,403].includes(error.status)){reset();}status(error.message);}
  finally{if(token===generation){busy=false;el('vendor-stock-save').disabled=!stock;}}
 }
 function render(){
  const summary=el('vendor-stock-summary');summary.replaceChildren();
  for(const [label,value] of [[t('rows'),stock.rows.length],[t('low'),stock.rows.filter(r=>r.status==='low').length],[t('soldOut'),stock.rows.filter(r=>r.status==='sold-out').length]]){const box=node('div');box.append(node('strong',value),node('span',label));summary.append(box);}
  const list=el('vendor-stock-list');list.replaceChildren();
  const search=el('vendor-stock-search').value.trim().toLowerCase(),filter=el('vendor-stock-filter').value;
  const rows=stock.rows.filter(row=>(filter==='all'||row.status===filter)&&[row.name,row.label,row.sku].join(' ').toLowerCase().includes(search));
  if(!rows.length)list.append(node('p',t('empty')));
  for(const row of rows){const id=JSON.stringify([row.productId,row.variantId]),value=pending.get(id)||row,card=node('article');card.className='vendor-stock-row';
   const head=node('header');head.append(node('h3',row.name),node('p',row.label),node('p',row.onHand===null?t('untracked'):t(row.status==='low'?'low':row.status==='sold-out'?'soldOut':'available')+': '+row.available+' · '+t('reserved')+': '+row.reserved));if(row.blocked)head.append(node('p',t('blocked')));card.append(head);
   const quantity=input(t('onHand'),value.onHand,'number'),sku=input(t('code'),value.sku),threshold=input(t('threshold'),value.lowStock,'number');sku.field.maxLength=80;
   const changed=()=>{const updated={productId:row.productId,variantId:row.variantId,onHand:quantity.field.value===''?null:Number(quantity.field.value),lowStock:threshold.field.value===''?null:Number(threshold.field.value),sku:sku.field.value};
    if(updated.onHand===row.onHand&&updated.lowStock===row.lowStock&&updated.sku===row.sku)pending.delete(id);else pending.set(id,updated);
    status(pending.size?t('changed')+' ('+pending.size+')':'');el('vendor-stock-review').hidden=true;};
   for(const field of [quantity,sku,threshold]){field.field.disabled=row.blocked;field.field.addEventListener('input',changed);card.append(field.wrap);}list.append(card);
  }
  if(stock.needsVariantSetup)list.append(node('p',t('needsVariants')));
  const history=el('vendor-stock-history');history.replaceChildren();
  for(const event of stock.history||[]){const entry=node('article');entry.className='vendor-stock-history-entry';entry.append(node('strong',new Date(event.recorded_at).toLocaleString(language)));
   for(const change of event.changes){const row=stock.rows.find(r=>r.productId===change.productId&&r.variantId===change.variantId);entry.append(node('p',[(change.name?[change.name,change.label].filter(Boolean).join(' · '):row?[row.name,row.label].filter(Boolean).join(' · '):change.productId),String(change.before??t('untracked'))+' → '+change.after,change.reason].join(' · ')));}history.append(entry);}
 }
 function review(){
  if(!active()||!stock||busy)return;if(!pending.size){status(t('noChanges'));return;}
  const reason=el('vendor-stock-reason').value.trim();if(!reason){status(t('reason'));el('vendor-stock-reason').focus();return;}
  const changes=Array.from(pending.values()).map(row=>({...row,reason}));
  if(changes.length>100||changes.some(row=>!Number.isSafeInteger(row.onHand)||row.onHand<0||row.onHand>1000000000||!Number.isSafeInteger(row.lowStock)||row.lowStock<0||row.lowStock>1000000000)){status(t('error'));return;}
  const panel=el('vendor-stock-review');panel.replaceChildren(node('h3',t('review')));panel.hidden=false;
  for(const change of changes){const old=stock.rows.find(r=>r.productId===change.productId&&r.variantId===change.variantId);panel.append(node('p',[old.name,old.label,String(old.onHand??t('untracked'))+' → '+change.onHand,change.sku].filter(Boolean).join(' · ')));}
  panel.append(node('p',reason));const save=node('button',t('confirm')),cancel=node('button',t('cancel'));save.type=cancel.type='button';save.className='demeos-primary-button';panel.append(save,cancel);cancel.onclick=()=>panel.hidden=true;
  const businessId=context,token=generation,revision=stock.revision,snapshot=stock.catalogueRevision;
  save.onclick=async()=>{if(!active()||busy||context!==businessId||token!==generation)return;busy=true;save.disabled=true;el('vendor-stock-save').disabled=true;el('vendor-stock-list').inert=true;el('vendor-stock-search').disabled=true;el('vendor-stock-filter').disabled=true;el('vendor-stock-import').disabled=true;
   try{const result=await request('inventory',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,catalogueRevision:snapshot,changes})});
    if(token!==generation||context!==businessId)return;
    stock={...stock,...result,history:[{revision:result.revision,recorded_at:new Date().toISOString(),changes:changes.map(change=>({...change,before:stock.rows.find(r=>r.productId===change.productId&&r.variantId===change.variantId).onHand,after:change.onHand}))},...(stock.history||[])]};pending.clear();panel.hidden=true;render();status(t('saved'));
   }catch(error){if(token===generation)status(error.status===409?t('conflict'):error.message);}
   finally{if(token===generation){busy=false;save.disabled=false;el('vendor-stock-save').disabled=false;el('vendor-stock-list').inert=false;el('vendor-stock-search').disabled=false;el('vendor-stock-filter').disabled=false;el('vendor-stock-import').disabled=false;}}
  };
 }
 async function loadCatalogue(){const token=generation,businessId=context;try{const data=await request('products');if(token!==generation||context!==businessId||!active())return;
   const current=root.DEMEOSVendorProducts.read();if(current.businessId!==businessId||JSON.stringify(current.baseline)!==JSON.stringify(data.products)){el('vendor-products-status').textContent=t('conflict');return;}
   catalogue=data;el('vendor-products-save').disabled=false;
  }catch(error){if(token===generation)el('vendor-products-status').textContent=error.message;}}
 async function saveProducts(){if(!active()||!catalogue||busy)return;const current=root.DEMEOSVendorProducts.read();if(current.businessId!==context)return;
  if(!el('vendor-products-confirm').checked){el('vendor-products-status').textContent=t('accurate');return;}
  const token=generation,businessId=context;busy=true;el('vendor-products-status').textContent=t('loading');el('vendor-products-save').disabled=true;el('products').inert=true;
  try{const result=await request('products',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({catalogueRevision:catalogue.catalogueRevision,products:current.products,accuracyConfirmed:true})});
   if(token!==generation||businessId!==context)return;catalogue=result;if(!pending.size){stock=null;el('vendor-stock-list').replaceChildren();}root.DEMEOSVendorProducts.saved(result.products,result.informationStatus);el('vendor-products-confirm').checked=false;el('vendor-products-status').textContent=t('productsSaved');
  }catch(error){if(token===generation)el('vendor-products-status').textContent=error.message;}
  finally{if(token===generation){busy=false;el('vendor-products-save').disabled=false;el('products').inert=false;if(root.location.hash==='#inventory'&&!stock)load();}}
 }
 function compactCatalogue(){
  const form=doc.querySelector('.business-product-form');if(!form)return;
  let editor=el('vendor-product-editor');
  const selling=root.DEMEOSOwnerWorkspace.getState(doc).model==='selling';
  if(!selling&&editor){editor.before(form);editor.remove();editor=null;}
  el('business-media-file').multiple=selling;
  const mediaHeading=el('business-media-heading'),paragraph=mediaHeading?.parentElement.querySelector('p');
  if(mediaHeading&&!mediaHeading.dataset.originalText){mediaHeading.dataset.originalText=mediaHeading.textContent;if(paragraph)paragraph.dataset.originalText=paragraph.textContent;}
  const routeWrap=el('business-product-route')?.parentElement;if(routeWrap)routeWrap.hidden=selling;
  const reviewSave=el('products-review-save');if(reviewSave)reviewSave.hidden=selling;
  if(!selling){if(mediaHeading?.dataset.vendorPrepared==='true'){mediaHeading.textContent=mediaHeading.dataset.originalText;if(paragraph)paragraph.textContent=paragraph.dataset.originalText;mediaHeading.dataset.vendorPrepared='false';}return;}
  if(!editor){editor=node('details');editor.id='vendor-product-editor';editor.className='vendor-stock-tools';const heading=node('summary',t('editProduct'));heading.dataset.vendorCopy='editProduct';heading.addEventListener('click',()=>{if(!editor.open)root.DEMEOSVendorProducts?.beginAdd();});editor.append(heading);form.before(editor);editor.append(form);}
  editor.querySelector('summary').hidden=false;
  for(const field of ['business-product-route']){const wrap=el(field)?.parentElement;if(wrap)wrap.hidden=selling;}
  if(mediaHeading&&selling){mediaHeading.dataset.vendorPrepared='true';mediaHeading.textContent=t('mediaHeading');if(paragraph)paragraph.textContent=t('mediaIntro');}
  const mediaOption=el('business-media-product')?.querySelector('option[value=""]');if(mediaOption&&selling)mediaOption.textContent=t('chooseProduct');
  const save=el('products-review-save');if(save)save.hidden=selling;
 }
 function activate(){compactCatalogue();const state=root.DEMEOSOwnerWorkspace.getState(doc);if(state.status!=='ready'||state.model!=='selling'){reset();return;}if(context===state.businessId)return;reset();context=state.businessId;load();loadCatalogue();}
 doc.addEventListener('owner-model-ready',activate);root.addEventListener('hashchange',()=>{if(root.location.hash==='#inventory'&&!pending.size)load();});
 el('owner-preparation-language')?.addEventListener('change',translate);
 el('vendor-stock-search').addEventListener('input',()=>stock&&render());el('vendor-stock-filter').addEventListener('change',()=>stock&&render());
 el('vendor-stock-save').addEventListener('click',review);el('vendor-stock-reload').addEventListener('click',()=>{if(pending.size&&!root.confirm(t('changed')+' — '+t('reload')+'?'))return;el('vendor-stock-review').hidden=true;load(true);});
 el('vendor-products-save').addEventListener('click',saveProducts);
 el('vendor-catalogue-search').addEventListener('input',event=>{const query=event.target.value.trim().toLowerCase();doc.querySelectorAll('.business-product-card').forEach(card=>{card.hidden=!card.textContent.toLowerCase().includes(query);});});
 el('vendor-stock-export').addEventListener('click',()=>{if(!stock||!active())return;const text=[['productId','variantId','onHand','lowStock','sku'],...stock.rows.map(r=>[r.productId,r.variantId,r.onHand,r.lowStock,r.sku])].map(row=>row.map(csvCell).join(',')).join('\r\n');const link=node('a');link.download='demeos-stock.csv';link.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));link.click();URL.revokeObjectURL(link.href);});
 el('vendor-stock-import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file||!stock||!active())return;const token=generation;
  try{if(file.size>1000000)throw Error(t('error'));const rows=parseCsv(await file.text());if(token!==generation)return;
   if(JSON.stringify(rows.shift())!==JSON.stringify(['productId','variantId','onHand','lowStock','sku']))throw Error(t('error'));
   const staged=new Map(pending),seen=new Set();for(const cells of rows){if(cells.length!==5)throw Error(t('error'));const [productId,variantId,onHand,lowStock,rawSku]=cells,id=JSON.stringify([productId,variantId]),row=stock.rows.find(r=>r.productId===productId&&r.variantId===variantId);
    if(!row||row.blocked||seen.has(id)||!/^\d+$/.test(onHand)||!/^\d+$/.test(lowStock)||Number(onHand)>1000000000||Number(lowStock)>1000000000)throw Error(t('error'));seen.add(id);
    const sku=rawSku.replace(/^'(?=[=+@\-\t\r])/,'');if(sku.length>80)throw Error(t('error'));const updated={productId,variantId,onHand:Number(onHand),lowStock:Number(lowStock),sku};
    if(updated.onHand!==row.onHand||updated.lowStock!==row.lowStock||sku!==row.sku)staged.set(id,updated);else staged.delete(id);}
   if(staged.size>100)throw Error(t('error'));pending=staged;el('vendor-stock-review').hidden=true;render();status(pending.size?t('changed')+' ('+pending.size+')':t('noChanges'));
  }catch(error){if(token===generation)status(error.message);}finally{event.target.value='';}});
 root.addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
 translate();activate();
})(typeof window==='undefined'?globalThis:window);
