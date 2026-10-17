(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document){root.DEMEOSSellingDashboard=api;api.createDashboard(root).start();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const sections=Object.freeze({
    overview:['Overview','Overview','These counts come from saved products, variants, inventory and recent private orders for this business.'],
    'my-business':['My Business','My Business','These details come from your existing business record. Registration and approval continue through the existing business workflow.'],
    'product-catalogue':['Product Catalogue','Product Catalogue','Review your saved products, variants, stock and private orders.'],
    'images-videos':['Images & Videos','Images & Videos','Upload actual files, review processing status and remove media belonging to your products.'],
    'options-variants':['Options & Variants','Options & Variants','Add, edit and remove saved variants for your catalogue products.'],
    'stock-history':['Stock & History','Stock & History','Set stock quantities and review the latest 30 ledger events. Earlier audit history remains stored.'],
    'private-orders':['Private Orders','Private Orders','View the real saved order records belonging to this business.']
  });
  function sectionForPath(path){
    if(['/selling-vendor','/selling-vendor/','/selling-dashboard.html'].includes(path))return 'overview';
    const match=path.match(/^\/selling-vendor\/([^/]+)\/?$/);
    return match&&Object.hasOwn(sections,match[1])?match[1]:null;
  }
  function createDashboard(win){
    const doc=win.document,$=id=>doc.getElementById(id);
    let clerk=null,sequence=0,controller=null,context=null,sessionKey=null,booting=false;
    const currentSection=()=>sectionForPath(win.location.pathname);
    let language='en',renderedContextKey='',searchSection='';
    let catalogueOffset=0,catalogueSnapshot='',searchTimer=null,editorRevision='',editorProductRevision='new',editorDirty=false;
    let categoryDraftValues={},orderCursor='',orderPrevious=[];
    const productSections=new Set(['product-catalogue','images-videos','options-variants','stock-history']);
    const catalogueFilters=['category','state','validation','availability','stock','sort'];
    const i18n=win.DEMEOSSellingCopy;
    try{language=i18n.resolve(win.localStorage.getItem('demeos-customer-language')).code;}catch{}
    const t=(text,values)=>i18n.translate(language,text,values);
    const apiError=(response,result)=>t(result?.error?.includes('reserved stock')?'Reserved stock prevents this change.':response.status===401?'Sign in again to restore access.':response.status===403?'Selling access unavailable':response.status===409?'Information changed. Reload and review.':response.status===400?'Check the required fields and permitted values.':'The service could not complete this action. Please retry.');
    const failureMessage=error=>['TypeError','SyntaxError','AbortError','TimeoutError'].includes(error?.name)?t('The service could not complete this action. Please retry.'):error?.message||t('The service could not complete this action. Please retry.');
    const staticText=[];
    const walker=doc.createTreeWalker(doc.body,4);
    for(let node;node=walker.nextNode();)if(node.textContent.trim()&&!['SCRIPT','STYLE'].includes(node.parentElement?.tagName))staticText.push({node,source:node.textContent.trim()});
    const staticAttributes=Array.from(doc.querySelectorAll('[aria-label],[alt]')).flatMap(node=>['aria-label','alt'].filter(attr=>node.hasAttribute(attr)).map(attr=>({node,attr,source:node.getAttribute(attr)})));
    function translateStatic(){$('media-filename').textContent=$('media-file').files[0]?.name||t('No file selected.');doc.title=t('Selling Vendor')+' | DEMEOS';for(const {node,source} of staticText)node.textContent=t(source);for(const {node,attr,source} of staticAttributes)node.setAttribute(attr,t(source));$('logo-filename').textContent=$('logo-file').files[0]?.name||t('No file selected.');doc.documentElement.dir=i18n.resolve(language).direction;translateSubmissions();$('product-form-title').textContent=t($('product-id').value?'Edit product':'Add product');$('variant-form-title').textContent=t($('variant-id').value?'Edit variant':'Add variant');}
    $('dashboard-language').replaceChildren(...i18n.languages.map(locale=>{const option=doc.createElement('option');option.value=locale.code;option.textContent=locale.name;return option;}));
    const sectionCopy=()=>Object.fromEntries(Object.entries(sections).map(([key,values])=>[key,values.map(value=>t(value))]));
    const submissionCopy=key=>(win.DEMEOSSellingSubmissionCopy?.[language]||win.DEMEOSSellingSubmissionCopy?.en||{})[key]||key;
    let openSubmissionId='';
    function translateSubmissions(){for(const node of doc.querySelectorAll('[data-submission-copy]'))node.textContent=submissionCopy(node.dataset.submissionCopy);}
    function translateNavigation(){translateStatic();for(const link of doc.querySelectorAll('nav [data-section]'))link.textContent=sectionCopy()[link.dataset.section][0];$('dashboard-language').value=language;doc.documentElement.lang=language;}
    function status(state,title,message){
      context=null;$('business-logo').hidden=true;$('business-logo').removeAttribute('src');$('private-workspace').hidden=true;$('business-name').textContent='';$('business-details').textContent='';$('business-facts').replaceChildren();$('business-select').replaceChildren();
      $('dashboard-status').hidden=false;$('dashboard-status').dataset.state=state;
      $('dashboard-status').setAttribute('aria-busy',String(state==='loading'));
      $('status-heading').textContent=title;$('status-message').textContent=message;
      $('retry').hidden=!['error','denied','empty'].includes(state);
      $('registration').hidden=!['empty','denied'].includes(state);
      $('choose-business').hidden=state!=='denied';
    }
    function navigation(){
      const section=currentSection();translateNavigation();$('section-heading').textContent=sectionCopy()[section]?.[0]||t('Page not found');
      for(const link of doc.querySelectorAll('nav [data-section]')){
        if(link.dataset.section===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
        const url=new URL(link.getAttribute('href'),win.location.origin),businessId=new URLSearchParams(win.location.search).get('businessId');
        if(businessId)url.searchParams.set('businessId',businessId);else url.searchParams.delete('businessId');
        link.setAttribute('href',url.pathname+url.search);
      }
      for(const link of doc.querySelectorAll('[data-catalogue-link],[data-workspace-link],#registration,#business-tools > a')){const url=new URL(link.getAttribute('href'),win.location.origin),id=new URLSearchParams(win.location.search).get('businessId');if(id)url.searchParams.set('businessId',id);else url.searchParams.delete('businessId');link.setAttribute('href',url.pathname+url.search);}
      return section;
    }
    function bounded(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(Error('timeout')),15000);})]).finally(()=>win.clearTimeout(timer));}
    async function request(url,signal){
      for(let attempt=0;attempt<2;attempt++){
        const token=await bounded(clerk.session?.getToken({skipCache:attempt===1})||Promise.resolve(null));
        const response=await win.fetch(url,{credentials:'same-origin',cache:'no-store',keepalive:true,signal,headers:token?{Authorization:'Bearer '+token}:{}});
        if(response.status!==401||attempt===1)return response;
      }
    }
    async function verifySavedBusiness(businessId,productId){
      const url='/api/businesses?resource=selling-dashboard&view=catalogue&businessId='+encodeURIComponent(businessId)+'&productId='+encodeURIComponent(productId);
      const response=await request(url,win.AbortSignal.timeout(15000));if(!response.ok)throw Error(t('The service could not complete this action. Please retry.'));const data=await response.json();if(data.vendor?.identityId!==clerk.user?.id||data.business?.businessId!==businessId)throw Error(t('Selling access unavailable'));return data.business;
    }
    const recordLists={'product-catalogue':'catalogue-list','images-videos':'media-list','options-variants':'variant-list','stock-history':'stock-list','private-orders':'orders-list'};
    function filterRecords(){
      const list=$(recordLists[currentSection()]);if(!list)return;
      if(productSections.has(currentSection())&&context?.business?.cataloguePage){const page=context.business.cataloguePage;$('record-count').textContent=t('{shown} of {total} saved records',{shown:context.business.products.length,total:page.catalogueTotal});return;}
      if(currentSection()==='private-orders'&&context?.business?.orderPage){$('record-count').textContent=t('{shown} of {total} saved records',{shown:context.business.orders.length,total:context.business.orderPage.total});return;}
      const query=$('record-search').value.trim().toLocaleLowerCase(language),records=Array.from(list.children).filter(node=>node.matches('.catalogue-item'));
      let shown=0;for(const record of records){record.hidden=Boolean(query&&!record.textContent.toLocaleLowerCase(language).includes(query));if(!record.hidden)shown++;}
      $('record-count').textContent=t('{shown} of {total} saved records',{shown,total:records.length});
    }
    $('record-search').addEventListener('input',()=>{if(!productSections.has(currentSection())&&currentSection()!=='private-orders'){filterRecords();return;}win.clearTimeout(searchTimer);searchTimer=win.setTimeout(()=>{if(currentSection()==='private-orders'){orderCursor='';orderPrevious=[];load();}else refreshCatalogue(true);},300);});
    function refreshCatalogue(reset=false){if(productMutationPending)return;if(currentSection()==='options-variants'&&$('variant-id').value){if(!win.confirm(t('Discard unsaved variant changes?')))return;clearVariantForm();}if(reset){catalogueOffset=0;catalogueSnapshot='';}load();}
    for(const key of catalogueFilters)$('catalogue-'+key).addEventListener('change',()=>refreshCatalogue(true));
    const selectedProducts=()=>Array.from(doc.querySelectorAll('[data-select-product]:checked')).map(node=>node.dataset.selectProduct);
    $('catalogue-export').addEventListener('click',()=>{const ids=selectedProducts();if(!ids.length){$('product-feedback').textContent=t('Select products first.');return;}const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['Product ID','Product name','SKU','Category','Price','Availability','Status'],...context.business.products.filter(p=>ids.includes(p.productId)).map(p=>[p.productId,p.name,p.sku,p.classification?.categoryId,p.price,p.availability,p.submission?.state||'draft'])];const url=win.URL.createObjectURL(new win.Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=doc.createElement('a');link.href=url;link.download='demeos-catalogue.csv';link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);});
    $('catalogue-apply').addEventListener('click',async()=>{const ids=selectedProducts(),business=context?.business;if(productMutationPending||!business)return;if(!ids.length){$('product-feedback').textContent=t('Select products first.');return;}if(!win.confirm(t('Update availability for selected products?')))return;mutationBusy(true);try{const token=await bounded(clerk.session.getToken());const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(business.businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'bulk-availability',productIds:ids,availability:$('catalogue-bulk-availability').value,confirmed:true,catalogueRevision:business.catalogueRevision})});const result=await response.json();if(!response.ok)throw Error(apiError(response,result));catalogueSnapshot='';catalogueOffset=0;await load();$('product-feedback').textContent=t('Availability updated.');}catch(error){$('product-feedback').textContent=failureMessage(error);}finally{mutationBusy(false);}});
    $('catalogue-previous').addEventListener('click',()=>{catalogueOffset=Math.max(0,catalogueOffset-25);refreshCatalogue();});
    $('catalogue-next').addEventListener('click',()=>{if(context?.business?.cataloguePage?.hasNext){catalogueOffset+=25;refreshCatalogue();}});
    $('orders-state').addEventListener('change',()=>{orderCursor='';orderPrevious=[];load();});
    $('orders-next').addEventListener('click',()=>{if(context?.business?.orderPage?.nextCursor){orderPrevious.push(orderCursor);orderCursor=context.business.orderPage.nextCursor;load();}});
    $('orders-previous').addEventListener('click',()=>{if(orderPrevious.length){orderCursor=orderPrevious.pop();load();}});
    const draftFields=['id','name','sku','description','price-mode','price','availability','category'];
    const draftKey=()=>clerk?.user?.id&&context?.business?.businessId?'demeos-selling-draft:'+clerk.user.id+':'+context.business.businessId:null;
    function captureCategoryFields(){const id=$('product-category').value;if(id)categoryDraftValues[id]=Object.fromEntries(Array.from($('product-category-fields').querySelectorAll('[data-category-field]')).map(node=>[node.dataset.categoryField,node.value]));}
    function renderCategoryFields(){const id=$('product-category').value,schema=context?.categories?.fieldDefinitions?.find(d=>d.categoryId===id);$('product-category-fields').replaceChildren();for(const field of schema?.fields||[]){const label=doc.createElement('label'),text=doc.createElement('span'),input=doc.createElement('textarea');text.textContent=t(field.label)+(field.required?' *':'');input.dataset.categoryField=field.key;input.maxLength=field.maxLength;input.required=field.required;input.value=categoryDraftValues[id]?.[field.key]||'';label.append(text,input);$('product-category-fields').append(label);}}
    function readCategoryFields(){captureCategoryFields();const id=$('product-category').value,schema=context?.categories?.fieldDefinitions?.find(d=>d.categoryId===id);return schema?{schemaVersion:schema.schemaVersion,categoryId:id,datasetVersion:schema.datasetVersion,values:categoryDraftValues[id]||{}}:undefined;}
    $('product-category').addEventListener('change',()=>{renderCategoryFields();rememberDraft();});
    function rememberDraft(){captureCategoryFields();editorDirty=true;const key=draftKey();if(!key)return;editorRevision=editorRevision||context.business.catalogueRevision;try{win.sessionStorage.setItem(key,JSON.stringify({revision:editorRevision,productRevision:editorProductRevision,categoryDraftValues,fields:Object.fromEntries(draftFields.map(k=>[k,$('product-'+k).value]))}));}catch{}}
    function recoverDraft(){const key=draftKey();if(!key||editorDirty)return;try{const cached=JSON.parse(win.sessionStorage.getItem(key));if(!cached?.revision||!cached.fields)return;for(const k of draftFields)if(typeof cached.fields[k]==='string')$('product-'+k).value=cached.fields[k];editorRevision=cached.revision;editorProductRevision=cached.productRevision||'new';editorDirty=true;categoryDraftValues=cached.categoryDraftValues||{};renderCategoryFields();syncProductPrice();$('product-feedback').textContent=t('Unsaved product recovered. Review before saving.');}catch{}}
    $('product-form').addEventListener('input',rememberDraft);$('product-form').addEventListener('change',rememberDraft);
    win.addEventListener('beforeunload',event=>{if(editorDirty){event.preventDefault();event.returnValue='';}});
    function render(data,preserveForms=false){
      if(data.contractVersion!==1||!data.vendor?.identityId||data.vendor.identityId!==clerk.user?.id||!Array.isArray(data.businesses))throw Error('Invalid context');
      const selected=new URLSearchParams(win.location.search).get('businessId');
      if(data.business&&(selected&&selected!==data.business.businessId||!data.businesses.some(b=>b.businessId===data.business.businessId)))throw Error('Invalid business');
      const ids=new Set();
      for(const business of data.businesses){if(!business?.businessId||ids.has(business.businessId)||!['live','test'].includes(business.dataEnvironment))throw Error('Invalid business list');ids.add(business.businessId);}
      if(!data.businesses.length){status('empty',t('No authorized Selling business yet'),t('This account has no business with Selling access in this environment. Contact the business administrator to confirm access.'));return;}
      const renderKey=data.vendor.identityId+':'+(data.business?.businessId||'');if(renderedContextKey!==renderKey){clearPrivateForms();renderedContextKey=renderKey;}
      context=data;$('dashboard-status').hidden=true;$('private-workspace').hidden=false;
      $('business-select').replaceChildren();
      if(!data.business){const placeholder=doc.createElement('option');placeholder.value='';placeholder.textContent=t('Choose your business');$('business-select').append(placeholder);}
      for(const business of data.businesses){const option=doc.createElement('option');option.value=business.businessId;option.textContent=business.name;$('business-select').append(option);}
      $('business-select').value=data.business?.businessId||'';
      $('business-select').disabled=data.businesses.length===1;
      const business=data.business;
      $('business-name').textContent=business?.identity?.name||business?.name||t('Choose a business');
      $('business-logo').hidden=!business?.logo?.previewUrl;
      if(business?.logo?.previewUrl)$('business-logo').src=business.logo.previewUrl;else $('business-logo').removeAttribute('src');
      $('logo-remove').hidden=!business?.logo;
      $('logo-pending').replaceChildren();
      if(sectionForPath(win.location.pathname)==='my-business')for(const asset of business?.logoUploads||[]){
        const row=doc.createElement('p');row.textContent=t('Business logo')+' · '+t(asset.state);
        if(['processing','ready'].includes(asset.state)){const resume=doc.createElement('button');resume.type='button';resume.textContent=t('Resume processing');resume.addEventListener('click',()=>changeLogo('resume-logo',{assetId:asset.assetId}));row.append(resume);}
        $('logo-pending').append(row);
      }
      $('business-details').textContent=business?[business.type,business.location].filter(Boolean).join(' · '):t('Only businesses authorized for your account are listed.');
      $('environment-label').textContent=business?(business.dataEnvironment==='test'?t('Test business · isolated data'):t('Selling access approved')):'';
      $('environment-label').dataset.environment=business?.dataEnvironment||'';
      const section=currentSection(),copy=sectionCopy()[section];translateSubmissions();
      if(searchSection!==section){$('record-search').value='';catalogueOffset=0;catalogueSnapshot='';searchSection=section;}$('record-tools').hidden=!business||!recordLists[section];
      const selectedCategory=$('product-category').value;$('product-category').replaceChildren();
      const blank=doc.createElement('option');blank.value='';blank.textContent=submissionCopy('chooseCategory');$('product-category').append(blank);
      for(const c of data.categories?.items||[]){const option=doc.createElement('option');option.value=c.categoryId;option.textContent=c.categoryId+' · '+c.categoryName;$('product-category').append(option);}
      $('product-category').value=selectedCategory;
      const filterCategory=$('catalogue-category').value;$('catalogue-category').replaceChildren();const all=doc.createElement('option');all.value='';all.textContent=t('All categories');$('catalogue-category').append(all);for(const c of data.categories?.items||[]){const option=doc.createElement('option');option.value=c.categoryId;option.textContent=c.categoryId+' · '+c.categoryName;$('catalogue-category').append(option);}$('catalogue-category').value=filterCategory;
      const stateFilter=$('catalogue-state').value;$('catalogue-state').replaceChildren();for(const value of ['',...(data.catalogueOptions?.states||[])]){const option=doc.createElement('option');option.value=value;option.textContent=value?submissionCopy(value):t('All statuses');$('catalogue-state').append(option);}$('catalogue-state').value=stateFilter;
      $('catalogue-pagination').hidden=!business||!productSections.has(section);
      if(business?.cataloguePage){const page=business.cataloguePage;catalogueSnapshot=page.snapshot;$('catalogue-previous').disabled=!page.offset;$('catalogue-next').disabled=!page.hasNext;$('catalogue-page-status').textContent=t('Page {page}',{page:Math.floor(page.offset/page.limit)+1});}
      recoverDraft();renderCategoryFields();
      $('content-heading').textContent=business?copy[1]:t('Select your business to continue');
      $('content-message').textContent=business?copy[2]:t('Use the business selector above. Your choice is kept in the page URL for refresh and direct navigation.');
      const catalogue=$('catalogue-list');
      catalogue.replaceChildren();
      $('catalogue-tools').hidden=section!=='product-catalogue'||!business;
      catalogue.hidden=section!=='product-catalogue'||!business;
      if(section==='product-catalogue'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent=t('Product Catalogue');
        $('content-message').textContent=products.length?t('Saved products'):t('No products saved yet.');
        for(const product of products){
          const item=doc.createElement('article');item.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=product.name||submissionCopy('untitled');
          const main=business.media?.find(a=>a.assetId===product.mediaGallery?.mainAssetId&&a.state==='ready'&&a.kind==='image');
          if(main?.previewUrl){const image=doc.createElement('img');image.src=main.previewUrl;image.alt=product.name||t('Product');image.className='product-media-preview';image.loading='lazy';item.append(image);}
          const description=doc.createElement('p');description.textContent=product.description||'';
          const price=doc.createElement('p');price.textContent=product.price||t('Contact for price');
          const availability=doc.createElement('p');availability.textContent=product.availability==='available'?t('Available'):product.availability==='unavailable'?t('Unavailable'):product.availability==='limited'?t('Limited availability'):t('Ask about availability');
          const edit=doc.createElement('button');edit.type='button';edit.textContent=t('Edit');
          edit.addEventListener('click',()=>{ if(editorDirty&&!win.confirm(t('Discard unsaved product changes?')))return;clearProductForm();editorRevision=business.catalogueRevision;editorProductRevision=product.authoringRevision;$('product-sku').value=product.sku||''; $('product-id').value=product.productId;$('product-name').value=product.name||'';$('product-description').value=product.description||'';$('product-price-mode').value=product.priceMode||'contact';$('product-price').value=product.price||'';syncProductPrice();$('product-availability').value=product.availability||'contact';$('product-category').value=product.classification?.categoryId||'';categoryDraftValues=structuredClone(product.categoryAttributes?.byCategory||{});renderCategoryFields();$('product-form-title').textContent=t('Edit product');$('product-name').focus(); });
          const remove=doc.createElement('button');remove.type='button';remove.textContent=t('Delete');
          remove.addEventListener('click',()=>{if(win.confirm(t('Delete this product?')))mutateProduct('delete-product',{productId:product.productId});});
          const metadata=doc.createElement('p');metadata.className='catalogue-metadata';const rows=business.inventory?.rows.filter(r=>r.productId===product.productId)||[];metadata.textContent=[product.productId,product.sku,context.categories.items.find(c=>c.categoryId===product.classification?.categoryId)?.categoryName,rows.length?t('Available stock')+': '+rows.map(r=>r.available??t('Not set')).join(' / '):'',product.submission?.updatedAt?t('Last updated')+': '+new Date(product.submission.updatedAt).toLocaleString(language):''].filter(Boolean).join(' · ');
          const select=doc.createElement('input');select.type='checkbox';select.dataset.selectProduct=product.productId;select.setAttribute('aria-label',t('Select product')+': '+(product.name||product.productId));item.append(select,title,metadata,description,price,availability,edit,remove);renderSubmission(item,product,business);catalogue.append(item);
        }
      }
      $('media-tools').hidden=section!=='images-videos'||!business;
      const selectedMediaProduct=$('media-product').value;
      $('media-product').replaceChildren();$('media-list').replaceChildren();
      if(section==='images-videos'&&business){
        for(const product of business.products||[]){const option=doc.createElement('option');option.value=product.productId;option.textContent=product.name||submissionCopy('untitled');$('media-product').append(option);}
        $('media-configuration').textContent=t(business.mediaCapabilities.blocker||'');
        $('media-empty').hidden=Boolean(business.products?.length);
        $('media-form').hidden=!business.products?.length;
        for(const asset of business.media||[]){
          const article=doc.createElement('article');article.className='catalogue-item';article.dataset.assetId=asset.assetId;
          const title=doc.createElement('h3');title.textContent=(business.products.find(p=>p.productId===asset.productId)?.name||t('Product'))+' · '+t(asset.kind==='image'?t('Image'):t('Video'));
          const state=doc.createElement('p');state.textContent=t(asset.state)+' · '+t(asset.linked?t('Linked to product'):t('Not linked'))+(asset.failureReason?' · '+t('Media processing failed. Remove this file and upload a valid replacement.'):'');article.append(title,state);
          if(asset.state==='processing'||asset.state==='ready'&&!asset.linked){const resume=doc.createElement('button');resume.type='button';resume.textContent=t('Resume processing');resume.addEventListener('click',()=>changeMedia('resume-media',{productId:asset.productId,assetId:asset.assetId}));article.append(resume);}
          if(asset.state==='ready'&&asset.previewUrl){const preview=doc.createElement(asset.kind==='image'?'img':'video');preview.src=asset.previewUrl;preview.className='product-media-preview';if(asset.kind==='image')preview.alt=title.textContent;else{preview.controls=true;preview.preload='metadata';preview.playsInline=true;}article.append(preview);}
          const remove=doc.createElement('button');remove.type='button';remove.textContent=t('Remove');remove.addEventListener('click',()=>{if(win.confirm(t('Remove this media from the product?')))changeMedia('remove-media',{productId:asset.productId,assetId:asset.assetId});});article.append(remove);if(asset.kind==='image'&&asset.state==='ready'&&asset.linked){const main=doc.createElement('button');main.type='button';main.dataset.mainAsset=asset.assetId;main.textContent=submissionCopy(asset.main?'mainImage':'setMain');main.disabled=asset.main;main.addEventListener('click',()=>changeMedia('set-main-media',{productId:asset.productId,assetId:asset.assetId}));article.append(main);}if(asset.linked){for(const direction of ['earlier','later']){const move=doc.createElement('button');move.type='button';move.textContent=t(direction==='earlier'?'Move earlier':'Move later');const ids=business.products.find(p=>p.productId===asset.productId)?.mediaGallery?.assetIds||[],index=ids.indexOf(asset.assetId);move.disabled=direction==='earlier'?index<=0:index===ids.length-1;move.addEventListener('click',()=>changeMedia('move-media',{productId:asset.productId,assetId:asset.assetId,direction}));article.append(move);}}$('media-list').append(article);
        }
        if(!business.media?.length){const empty=doc.createElement('p');empty.textContent=t('No product media saved.');$('media-list').append(empty);}
        if(business.products.some(p=>p.productId===selectedMediaProduct))$('media-product').value=selectedMediaProduct;
        syncMediaForm();
      }
      $('variant-tools').hidden=section!=='options-variants'||!business;
      const selectedVariantProduct=$('variant-product').value;$('variant-product').replaceChildren();
      $('variant-list').replaceChildren();
      if(section==='options-variants'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent=sectionCopy()['options-variants'][1];
        $('content-message').textContent=products.length?sectionCopy()['options-variants'][2]:t('Add a saved product first.');
        for(const product of products){
          const option=doc.createElement('option');option.value=product.productId;option.textContent=product.name||product.productId;$('variant-product').append(option);
          const article=doc.createElement('article');article.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=product.name||submissionCopy('untitled');article.append(title);
          const variants=Array.isArray(product.variants)?product.variants:[];
          if(!variants.length){const empty=doc.createElement('p');empty.textContent=t('No variants saved.');article.append(empty);}
          for(const variant of variants){
            const row=doc.createElement('div');row.className='variant-item';
            const name=doc.createElement('strong');name.textContent=variant.name||t('Unnamed variant');
            const detail=doc.createElement('span');detail.textContent=[variant.sku?('SKU: '+variant.sku):'',variant.price?(t('Price')+': '+variant.price):'',variant.availability==='available'?t('Available'):variant.availability==='unavailable'?t('Unavailable'):variant.availability==='limited'?t('Limited availability'):t('Ask about availability')].filter(Boolean).join(' · ');
            const edit=doc.createElement('button');edit.type='button';edit.textContent=t('Edit');
            edit.addEventListener('click',()=>{$('variant-product').value=product.productId;$('variant-id').value=variant.variantId;$('variant-name').value=variant.name||'';$('variant-sku').value=variant.sku||'';$('variant-price').value=variant.price||'';$('variant-use-base-price').checked=variant.inheritsPrice===true;$('variant-current-price').textContent=variant.structuredPrice?t('Existing structured price: {price}. Leave the override blank to retain it, or select the product price.',{price:variant.structuredPrice}):'';$('variant-availability').value=variant.availability||'contact';$('variant-form-title').textContent=t('Edit variant');$('variant-name').focus();});
            const remove=doc.createElement('button');remove.type='button';remove.textContent=t('Delete');
            remove.addEventListener('click',()=>{if(win.confirm(t('Delete this variant?')))mutateVariant('delete-variant',{productId:product.productId,variantId:variant.variantId});});
            row.append(name,detail,edit,remove);article.append(row);
          }
          $('variant-list').append(article);
        }
        if(products.some(p=>p.productId===selectedVariantProduct))$('variant-product').value=selectedVariantProduct;else if(selectedVariantProduct)clearVariantForm();
        if(!products.length){const link=doc.createElement('a');link.textContent=t('Add product');link.href='/selling-vendor/product-catalogue?businessId='+encodeURIComponent(business.businessId);$('variant-list').append(link);}
        $('variant-save').disabled=productMutationPending||!products.length;
      }
      $('stock-tools').hidden=section!=='stock-history'||!business;
      const selectedStockProduct=$('stock-product').value;$('stock-product').replaceChildren();
      $('stock-list').replaceChildren();
      if(section==='stock-history'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent=t('Stock & History');
        $('content-message').textContent=products.length?t('Set stock quantities and review the latest 30 ledger events. Earlier audit history remains stored.'):t('Add products in Product Catalogue before managing stock.');
        const rows=business.inventory?.rows||[];
        for(const row of rows){
          const option=doc.createElement('option');option.value=JSON.stringify([row.productId,row.variantId]);option.textContent=[row.name,row.label].filter(Boolean).join(' · ');$('stock-product').append(option);
          const article=doc.createElement('article');article.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=option.textContent;
          const count=doc.createElement('p');count.textContent=t('Quantity')+': '+(row.onHand??t('Not set'))+' · '+t('Reserved')+': '+row.reserved+' · '+t('Available stock')+': '+(row.available??t('Not set'))+' · '+t('Low-stock threshold')+': '+row.lowStock;article.append(title,count);
          if(row.blocked){const warning=doc.createElement('p');warning.textContent=t('Stock belongs to earlier product options.');warning.setAttribute('role','status');article.append(warning);}
          for(const batch of business.inventory.history||[])for(const event of batch.changes||[]){
            if(event.productId!==row.productId||(event.variantId||'')!==row.variantId)continue;
            const line=doc.createElement('p');line.textContent=new Date(batch.recorded_at).toLocaleString(language)+' · '+(event.event?(t('Order')+' '+t(event.event)+' · '+t('Reserved')+' '+event.beforeReserved+' → '+event.afterReserved):(event.before??t('Not set'))+' → '+event.after+' · '+event.reason)+' · '+batch.trusted_identity_id;article.append(line);
          }
          for(const event of (products.find(p=>p.productId===row.productId)?.stockHistory||[]).slice().reverse()){
            const line=doc.createElement('p');line.textContent=t('Earlier record')+' · '+event.changedAt+' · '+(event.from??t('Not set'))+' → '+event.to+' · '+event.note;article.append(line);
          }
          $('stock-list').append(article);
        }
        if(rows.some(r=>JSON.stringify([r.productId,r.variantId])===selectedStockProduct))$('stock-product').value=selectedStockProduct;
        if(!rows.length){const link=doc.createElement('a');link.textContent=t('Add product');link.href='/selling-vendor/product-catalogue?businessId='+encodeURIComponent(business.businessId);$('stock-list').append(link);}
        $('stock-save').disabled=productMutationPending||!rows.length;
        const row=rows.find(r=>JSON.stringify([r.productId,r.variantId])===$('stock-product').value);
        if(!preserveForms){$('stock-quantity').value=row?.onHand===null||!row?'':String(row.onHand);$('stock-low-stock').value=String(row?.lowStock??5);}
      }
      $('business-tools').hidden=section!=='my-business'||!business;
      if(section==='my-business'&&business&&!preserveForms){$('business-edit-name').value=business.name;$('business-edit-location').value=business.location;$('business-edit-description').value=business.details.productsServices;for(const field of ['email','phone','website'])$('business-edit-'+field).value=business.details.customerContinuation[field]||'';$('business-accuracy').checked=false;}
      $('overview-tools').hidden=section!=='overview'||!business;$('overview-facts').hidden=section!=='overview'||!business;$('overview-facts').replaceChildren();
      if(section==='overview'&&business)for(const [key,label] of [['products',t('Saved products')],['availableProducts',t('Available products')],['variants',t('Saved variants')],['draftProducts',t('Draft products')],['correctionProducts',t('Products needing correction')],['lowStockProducts',t('Low-stock products')],['outOfStockProducts',t('Out-of-stock products')],['mediaAttention',t('Media requiring attention')],['trackedStockRows',t('Tracked stock rows')],['recentOrders',t('Recent private orders (up to 50)')]]){const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=t(label);dd.textContent=String(business.summary[key]);dd.dataset.metric=key;$('overview-facts').append(dt,dd);}
      $('orders-tools').hidden=section!=='private-orders'||!business;$('orders-list').replaceChildren();
      if(section==='private-orders'&&business){
        $('orders-previous').disabled=!orderPrevious.length;$('orders-next').disabled=!business.orderPage?.nextCursor;
        if(!business.orders.length){const empty=doc.createElement('p');empty.textContent=t('No private orders saved for this business.');$('orders-list').append(empty);}
        for(const order of business.orders){
          const details=doc.createElement('details');details.className='catalogue-item';const heading=doc.createElement('summary');heading.textContent=t('Order')+' '+order.id+' · '+t(order.state);details.append(heading);
          for(const [label,value] of [[t('Created'),order.createdAt],[t('Reservation expiry'),order.expiresAt],[t('Product'),order.line.name],[t('Product ID'),order.line.productId],[t('Variant ID'),order.line.variantId||t('None')],[t('Quantity'),order.line.quantity],[t('Currency'),order.line.currency],[t('Total (minor units)'),order.line.totalPriceMinor],[t('Payment'),order.paymentState]]){const line=doc.createElement('p');line.textContent=t(label)+': '+(label===t('Payment')?t(String(value)):String(value));details.append(line);}
          $('orders-list').append(details);
        }
      }
      $('business-facts').hidden=section!=='my-business'||!business;
      $('business-facts').replaceChildren();
      if(section==='my-business'&&business)for(const [label,value] of [[t('Business ID'),business.businessId],[t('Business name'),business.name],[t('Business type'),business.type||t('Not provided')],[t('Location'),business.location||t('Not provided')],[t('Selling access'),business.dataEnvironment==='test'?t('Test access authorized'):t('Approved')],[t('Description'),business.details.productsServices||t('Not provided')],[t('Email'),business.details.customerContinuation.email||t('Not provided')],[t('Phone'),business.details.customerContinuation.phone||t('Not provided')],[t('Website'),business.details.customerContinuation.website||t('Not provided')]]){
        const term=doc.createElement('dt'),detail=doc.createElement('dd');term.textContent=t(label);detail.textContent=value;$('business-facts').append(term,detail);
      }
      filterRecords();
    }
    async function load(){
      const turn=++sequence;controller?.abort();controller=new AbortController();
      if(!navigation()){status('error',t('Page not found'),t('Choose a dashboard section from the navigation.'));return;}
      $('sign-in').hidden=Boolean(clerk?.user);$('sign-out').hidden=!clerk?.user;
      $('vendor-identity').textContent=clerk?.user?(clerk.user.fullName||clerk.user.primaryEmailAddress?.emailAddress||t('Business account')):'';
      if(!clerk?.user){status(clerk?.session?'loading':'signed-out',clerk?.session?t('Restoring your session'):t('Sign in to your Selling dashboard'),clerk?.session?t('Checking your current account…'):t('Use your existing DEMEOS business account. Access is checked against your saved business ownership and server-authorized Selling access.'));return;}
      const identity=clerk.user.id;
      if(searchSection!==currentSection()){$('record-search').value='';catalogueOffset=0;catalogueSnapshot='';searchSection=currentSection();}
      status('loading',t('Loading your business'),t('Checking your saved ownership and Selling access…'));
      const url=new URL('/api/businesses',win.location.origin);url.searchParams.set('resource','selling-dashboard');
      if(productSections.has(currentSection())){url.searchParams.set('view','catalogue');url.searchParams.set('q',$('record-search').value);for(const key of catalogueFilters)url.searchParams.set(key,currentSection()==='product-catalogue'?$('catalogue-'+key).value:key==='sort'?'updated':'');url.searchParams.set('offset',String(catalogueOffset));if(catalogueSnapshot)url.searchParams.set('snapshot',catalogueSnapshot);}
      if(currentSection()==='overview')url.searchParams.set('view','overview');if(currentSection()==='my-business')url.searchParams.set('view','business');
      if(currentSection()==='private-orders'){url.searchParams.set('view','orders');url.searchParams.set('q',$('record-search').value);url.searchParams.set('orderState',$('orders-state').value);url.searchParams.set('orderCursor',orderCursor);}
      const selected=new URLSearchParams(win.location.search).get('businessId');if(selected)url.searchParams.set('businessId',selected);
      const requestController=controller,timeout=win.setTimeout(()=>requestController.abort(),15000);
      try{
        const response=await request(url.pathname+url.search,requestController.signal);
        if(turn!==sequence||identity!==clerk.user?.id)return;
        if(response.status===401){status('denied',t('Your session needs sign-in'),t('Sign in again to restore access.'));$('sign-in').hidden=false;return;}
        if(response.status===403){status('denied',t('Selling access unavailable'),t('This business is not authorized for your account in this environment. Choose an authorized business, or contact the business administrator.'));return;}
        if(response.status===409&&productSections.has(currentSection())){catalogueOffset=0;catalogueSnapshot='';await load();return;}
        if(!response.ok)throw Error('Context unavailable');
        const data=await response.json();if(turn===sequence&&identity===clerk.user?.id)render(data);
      }catch{if(turn===sequence)status('error',t('Could not open your dashboard'),t('Your business information could not be loaded. Check your connection and try again.'));}
      finally{win.clearTimeout(timeout);}
    }
    async function script(src,key){
      return bounded(new Promise((resolve,reject)=>{const node=doc.createElement('script');node.src=src;node.async=true;node.crossOrigin='anonymous';if(key)node.dataset.clerkPublishableKey=key;node.onload=resolve;node.onerror=()=>{node.remove();reject(Error('Authentication SDK unavailable'));};doc.head.append(node);}));
    }
    const authLocales=new Map();
    // A document navigation must not cancel an in-flight locale read in WebKit.
    // This small same-origin GET carries no credentials outside the application.
    async function authLocalization(){const code=language;if(!authLocales.has(code)){const response=await bounded(win.fetch(code==='tr'?'/js/selling-auth-tr.json':'/js/customer-auth-locales/'+code+'.json',{credentials:'same-origin',keepalive:true}));if(!response.ok)throw Error(t('Sign-in is temporarily unavailable'));const copy=await response.json();if(!copy.locale?.startsWith(code))throw Error(t('Sign-in is temporarily unavailable'));authLocales.set(code,copy);}return authLocales.get(code);}
    async function start(){
      if(booting)return;booting=true;navigation();status('loading',t('Opening your workspace'),t('Checking your session and business access…'));
      try{
        const response=await bounded(win.fetch('/api/public-config',{credentials:'same-origin',cache:'no-store',keepalive:true}));
        if(!response.ok)throw Error('Authentication configuration unavailable');
        const config=await response.json(),key=config.clerkPublishableKey;
        if(typeof key!=='string'||!/^pk_(test|live)_/.test(key))throw Error('Invalid authentication configuration');
        const domain=win.atob(key.split('_')[2]).replace(/\$$/,'');
        if(!/^[a-z0-9.-]+$/i.test(domain))throw Error('Invalid authentication domain');
        if(!win.__internal_ClerkUICtor)await script('https://'+domain+'/npm/@clerk/ui@1/dist/ui.browser.js');
        if(!win.Clerk)await script('https://'+domain+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js',key);
        const candidate=win.Clerk;await bounded(candidate.load({ui:{ClerkUI:win.__internal_ClerkUICtor},localization:await authLocalization()}));clerk=candidate;
        if(new URLSearchParams(win.location.search).get('clerk_oauth_callback')==='1')await bounded(clerk.handleRedirectCallback({signInForceRedirectUrl:'/selling-vendor',signUpForceRedirectUrl:'/selling-vendor',signInFallbackRedirectUrl:'/selling-vendor',signUpFallbackRedirectUrl:'/selling-vendor'}));
        clerk.addListener(()=>{
          const key=(clerk.user?.id||'')+':'+(clerk.session?.id||'');
          if(key!==sessionKey){clearPrivateForms();sessionKey=key;load();}
        });
        sessionKey=(clerk.user?.id||'')+':'+(clerk.session?.id||'');await load();
      }catch{clerk=null;status('error',t('Sign-in is temporarily unavailable'),t('We could not connect to DEMEOS authentication. Please try again.'));}
      finally{booting=false;}
    }
    $('dashboard-language').addEventListener('change',()=>{language=i18n.resolve($('dashboard-language').value).code;try{win.localStorage.setItem('demeos-customer-language',language);}catch{}navigation();if(context)render(context,true);else load();});
    function clearPrivateForms(){
      $('record-search').value='';orderCursor='';orderPrevious=[];$('record-count').textContent='';
      const priorKey=draftKey();let recovery=null;try{if(priorKey)recovery=win.sessionStorage.getItem(priorKey);}catch{}clearProductForm();try{if(priorKey&&recovery)win.sessionStorage.setItem(priorKey,recovery);}catch{}clearVariantForm();
      for(const id of ['stock-form','media-form','business-form','logo-form'])$(id).reset();
      for(const id of ['submission-feedback','product-feedback','variant-feedback','stock-feedback','media-feedback','business-feedback','logo-feedback'])$(id).textContent='';
      mediaAttempt=null;logoAttempt=null;$('logo-filename').textContent=t('No file selected.');$('media-filename').textContent=t('No file selected.');
    }
    function syncProductPrice(){
      const contact=$('product-price-mode').value==='contact';
      $('product-price').disabled=contact;
      $('product-price').required=!contact;
      if(contact)$('product-price').value='';
    }
    $('product-price-mode').addEventListener('change',syncProductPrice);
    function productClassification(){const category=context?.categories?.items.find(c=>c.categoryId===$('product-category').value);return category?{categoryId:category.categoryId,sectorId:category.sectorId,datasetVersion:context.categories.datasetVersion}:null;}
    function clearProductForm(){
      const key=draftKey();try{if(key)win.sessionStorage.removeItem(key);}catch{}editorRevision='';editorProductRevision='new';editorDirty=false;categoryDraftValues={};$('product-category-fields').replaceChildren();
      $('product-form').reset();$('product-id').value='';$('product-form-title').textContent=t('Add product');syncProductPrice();
    }
    function clearVariantForm(){
      const productId=$('variant-product').value;
      $('variant-form').reset();$('variant-current-price').textContent='';$('variant-id').value='';$('variant-form-title').textContent=t('Add variant');
      if(productId&&Array.from($('variant-product').options).some(option=>option.value===productId))$('variant-product').value=productId;
    }
    syncProductPrice();
    let productMutationPending=false;
    function mutationBusy(busy){
      productMutationPending=busy;$('dashboard-language').disabled=busy;
      for(const control of doc.querySelectorAll('#catalogue-tools input,#catalogue-tools textarea,#catalogue-tools select,#catalogue-tools button,#catalogue-list button,#catalogue-list input,#variant-tools input,#variant-tools select,#variant-tools button,#stock-tools input,#stock-tools select,#stock-tools button,#media-tools input,#media-tools select,#media-tools button,#business-tools input,#business-tools textarea,#business-tools button'))control.disabled=busy;
      $('business-select').disabled=busy||context?.businesses.length===1;
      if(!busy){for(const button of doc.querySelectorAll('[data-submit-product]')){const product=context?.business?.products.find(p=>p.productId===button.dataset.submitProduct);button.disabled=product?.submission?.state==='rejected'||product?.submission?.state==='validating'&&Date.now()-Date.parse(product.submission.attempt?.startedAt)<30000;}for(const button of doc.querySelectorAll('[data-main-asset]'))button.disabled=context?.business?.media.find(a=>a.assetId===button.dataset.mainAsset)?.main===true;syncProductPrice();syncMediaForm();$('variant-save').disabled=!$('variant-product').options.length;$('stock-save').disabled=!$('stock-product').options.length;}
    }
    async function mutateProduct(action,product){
      if(productMutationPending)return;
      const businessId=context?.business?.businessId;
      if(!businessId)return;
      const catalogueRevision=action==='delete-product'?context.business.catalogueRevision:(editorRevision||context.business.catalogueRevision),identity=clerk.user.id;
      mutationBusy(true);
      const button=$('product-save');button.disabled=true;
      $('product-cancel').disabled=true;
      for(const control of $('catalogue-list').querySelectorAll('button'))control.disabled=true;
      $('product-feedback').textContent=action==='delete-product'?t('Deleting…'):t('Saving…');
      try{
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error(t('Sign in again before changing products.'));
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action,product,catalogueRevision,productRevision:editorProductRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(apiError(response,result));
        catalogueSnapshot='';catalogueOffset=0;await load();
        const selectedAfterSave=new URLSearchParams(win.location.search).get('businessId');
        if(!context?.business||context.business.businessId!==businessId||
          (selectedAfterSave&&selectedAfterSave!==businessId)||clerk.user?.id!==identity||
          !$('dashboard-status').hidden||$('private-workspace').hidden)
          throw Error(t('Product saved, but the dashboard could not refresh. Reload before editing again.'));
        const confirmed=result.product||context.business.products.find(p=>p.productId===product.productId);
        if(action==='delete-product'?Boolean(confirmed):!confirmed||['name','description','priceMode','price','availability'].some(k=>product[k]!==undefined&&confirmed[k]!==product[k].trim()))throw Error(t('Could not verify the product change. Reload before editing again.'));
        clearProductForm();$('product-feedback').textContent=action==='delete-product'?t('Product deleted.'):action==='save-draft'?submissionCopy('saved'):t('Product saved.');
      }catch(error){$('product-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);button.disabled=false;$('product-cancel').disabled=false;
        for(const control of $('catalogue-list').querySelectorAll('button'))control.disabled=false;}
    }
    function renderSubmission(article,product,business){
      const state=product.submission?.state||'notSubmitted',status=doc.createElement('p');status.dataset.productState=product.productId;status.textContent=submissionCopy(state);article.append(status);
      const details=doc.createElement('details');details.dataset.submission=product.productId;details.open=openSubmissionId===product.productId;
      const summary=doc.createElement('summary');summary.textContent=submissionCopy('review');details.append(summary);
      details.addEventListener('toggle',()=>{if(details.open)openSubmissionId=product.productId;});
      const category=doc.createElement('p');category.textContent=submissionCopy('category')+': '+(context.categories.items.find(c=>c.categoryId===product.classification?.categoryId)?.categoryName||submissionCopy('chooseCategory'));details.append(category);
      if(product.submission?.publication?.state==='published'&&product.submission.publication.version!==product.submission.version){const prior=doc.createElement('p');prior.textContent=submissionCopy('previousPublication');details.append(prior);}
      const mediaHeading=doc.createElement('h4');mediaHeading.textContent=submissionCopy('media');details.append(mediaHeading);
      for(const asset of business.media.filter(a=>a.productId===product.productId)){
        const media=doc.createElement('p');media.textContent=asset.assetId+' · '+submissionCopy(asset.state==='ready'?'passed':asset.state==='failed'?'failed':'validating');details.append(media);
        if(asset.state==='ready'&&asset.previewUrl){const preview=doc.createElement(asset.kind==='image'?'img':'video');preview.src=asset.previewUrl;preview.alt=product.name;if(asset.kind==='video'){preview.controls=true;preview.preload='metadata';preview.playsInline=true;}preview.className='submission-preview';details.append(preview);}
      }
      const checksHeading=doc.createElement('h4');checksHeading.textContent=submissionCopy('checks');details.append(checksHeading);
      for(const rule of product.submission?.validation?.rules||product.submission?.review?.rules||[]){const line=doc.createElement('p');line.dataset.validationRule=rule.id;line.textContent=(rule.id==='category-fields'?t('Category fields'):submissionCopy(rule.id))+': '+submissionCopy(rule.status);details.append(line);}
      const review=doc.createElement('button');review.type='button';review.dataset.reviewProduct=product.productId;review.textContent=submissionCopy('review');review.addEventListener('click',()=>changeSubmission('review-product',product.productId));details.append(review);
      const label=doc.createElement('label'),confirm=doc.createElement('input');confirm.type='checkbox';confirm.dataset.submissionConfirm=product.productId;label.append(confirm,doc.createTextNode(submissionCopy('confirm')));details.append(label);
      const submit=doc.createElement('button');submit.type='button';submit.dataset.submitProduct=product.productId;submit.textContent=submissionCopy('submit');submit.disabled=state==='validating'&&Date.now()-Date.parse(product.submission?.attempt?.startedAt)<30000||state==='rejected';submit.addEventListener('click',()=>changeSubmission('submit-product',product.productId,confirm.checked));details.append(submit);
      if(state==='approved'){const publish=doc.createElement('button');publish.type='button';publish.dataset.publishProduct=product.productId;publish.textContent=submissionCopy('publish');publish.addEventListener('click',()=>changeSubmission('publish-product',product.productId));details.append(publish);}
      if(product.submission?.publication?.state==='published'){const revoke=doc.createElement('button');revoke.type='button';revoke.dataset.unpublishProduct=product.productId;revoke.textContent=submissionCopy('unpublish');revoke.addEventListener('click',()=>changeSubmission('unpublish-product',product.productId));details.append(revoke);}
      if(product.submission?.history?.length){const history=doc.createElement('details'),heading=doc.createElement('summary');heading.textContent=submissionCopy('history');history.append(heading);for(const event of product.submission.history){const row=doc.createElement('p');row.textContent=new Date(event.at).toLocaleString(language)+' · '+submissionCopy(event.state);history.append(row);}details.append(history);}
      article.append(details);
    }
    async function changeSubmission(action,productId,confirmed=false){
      if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id,catalogueRevision=context.business.catalogueRevision;
      mutationBusy(true);$('submission-feedback').textContent=submissionCopy(action==='submit-product'?'validating':'saving');openSubmissionId=productId;
      try{
        const token=await bounded(clerk.session.getToken());if(!token)throw Error(submissionCopy('error'));
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,product:{productId},confirmed,catalogueRevision})});
        const result=await response.json();if(!response.ok)throw Error(submissionCopy(result.code&&win.DEMEOSSellingSubmissionCopy.en[result.code]?result.code:'error'));
        catalogueSnapshot='';await load();const verified=await verifySavedBusiness(businessId,productId),saved=verified.products.find(p=>p.productId===productId);
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||!saved||saved.submission?.state!==result.state||$('private-workspace').hidden)throw Error(submissionCopy('error'));
        $('submission-feedback').textContent=submissionCopy(result.state);
      }catch(error){$('submission-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);}
    }
    async function mutateVariant(action,product){
      if(productMutationPending)return;
      const businessId=context?.business?.businessId;
      if(!businessId)return;
      const catalogueRevision=context.business.catalogueRevision,identity=clerk.user.id;
      mutationBusy(true);
      $('variant-save').disabled=true;$('variant-cancel').disabled=true;
      for(const control of $('variant-list').querySelectorAll('button'))control.disabled=true;
      $('variant-feedback').textContent=action==='delete-variant'?t('Deleting variant…'):t('Saving variant…');
      try{
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error(t('Sign in again before changing variants.'));
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action,product,catalogueRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(apiError(response,result));
        catalogueSnapshot='';await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden||!$('dashboard-status').hidden||(new URLSearchParams(win.location.search).get('businessId')&&new URLSearchParams(win.location.search).get('businessId')!==businessId))
          throw Error(t('Variant saved, but the dashboard could not refresh.'));
        const verified=await verifySavedBusiness(businessId,product.productId),confirmed=verified.products.find(p=>p.productId===product.productId)?.variants.find(v=>v.variantId===product.variantId);
        if(action==='delete-variant'?Boolean(confirmed):!confirmed||['name','sku','price','availability'].some(k=>k==='price'&&product.price&&confirmed.price?Number(confirmed.price)!==Number(product.price):confirmed[k]!==product[k].trim()))throw Error(t('Could not verify the variant change. Reload before editing again.'));
        clearVariantForm();$('variant-feedback').textContent=action==='delete-variant'?t('Variant deleted.'):t('Variant saved.');
      }catch(error){$('variant-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);$('variant-save').disabled=!$('variant-product').options.length;$('variant-cancel').disabled=false;
        for(const control of $('variant-list').querySelectorAll('button'))control.disabled=false;}
    }
    let logoAttempt=null;
    $('logo-choose').addEventListener('click',()=>$('logo-file').click());
    $('logo-file').addEventListener('change',()=>{logoAttempt=null;$('logo-filename').textContent=$('logo-file').files[0]?.name||t('No file selected.');$('logo-feedback').textContent='';});
    $('logo-remove').addEventListener('click',()=>{if(context?.business?.logo&&win.confirm(t('Remove business logo?')))changeLogo('remove-logo',{assetId:context.business.logo.assetId});});
    $('logo-form').addEventListener('submit',event=>{
      event.preventDefault();const file=$('logo-file').files[0];if(!file)return;
      const contentType=file.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'})[file.name.split('.').pop().toLowerCase()];
      if(!['image/jpeg','image/png','image/webp'].includes(contentType)||file.size<1||file.size>15*1024*1024){$('logo-feedback').textContent=t('Choose a supported image up to 15 MB or video up to 250 MB.');return;}
      if(!logoAttempt||logoAttempt.file!==file)logoAttempt={file,assetId:'media-'+win.crypto.randomUUID()};
      changeLogo('register-logo',{assetId:logoAttempt.assetId,kind:'image',contentType,sizeBytes:file.size},file);
    });
    async function changeLogo(action,item,file){
      if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id,revision=context.business.catalogueRevision;
      mutationBusy(true);$('logo-feedback').textContent=t(file?'Uploading file…':'Saving…');
      const post=async(nextAction,logo)=>{
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId)throw Error(t('Your account or business changed. Reload before continuing.'));
        const token=await bounded(clerk.session.getToken());if(!token)throw Error(t('Sign in again before saving.'));
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(90000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:nextAction,logo,catalogueRevision:revision})});
        const result=await response.json();if(!response.ok)throw Error(apiError(response,result));return result;
      };
      try{
        let result;
        if(file){
          const registered=logoAttempt?.registered||await post('register-logo',item),upload=registered.uploadSession;item.assetId=registered.assetId;
          if(logoAttempt?.file===file)logoAttempt.registered=registered;
          let transfer;try{transfer=await win.fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':item.contentType,...upload.headers},body:file,signal:win.AbortSignal.timeout(90000)});}catch{}
          if(transfer&&!transfer.ok&&![409,412].includes(transfer.status))throw Error(t('File transfer failed. Retry the upload.'));
          result=await post('complete-logo',{assetId:registered.assetId,storageKey:upload.storageKey,uploadToken:upload.uploadToken});
        }else result=await post(action,item);
        catalogueSnapshot='';await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden)throw Error(t('Media changed, but the dashboard could not refresh. Reload before continuing.'));
        if(result.state){$('logo-feedback').textContent=t('File stored; processing is not complete.');return;}
        if(action==='remove-logo'?Boolean(context.business.logo):context.business.logo?.assetId!==item.assetId||!context.business.logo?.previewUrl)throw Error(t('Could not verify the saved media change. Reload before continuing.'));
        $('logo-file').value='';$('logo-filename').textContent=t('No file selected.');logoAttempt=null;$('logo-feedback').textContent=t('Business logo saved.');
      }catch(error){$('logo-feedback').textContent=failureMessage(error);}finally{mutationBusy(false);}
    }
    $('business-form').addEventListener('submit',async event=>{
      event.preventDefault();if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id,catalogueRevision=context.business.catalogueRevision;
      const details={name:$('business-edit-name').value.trim(),location:$('business-edit-location').value.trim(),productsServices:$('business-edit-description').value.trim(),customerContinuation:Object.fromEntries(['email','phone','website'].map(field=>[field,$('business-edit-'+field).value.trim()]))},ownerAccuracyConfirmed=$('business-accuracy').checked;
      mutationBusy(true);$('business-feedback').textContent=t('Saving business details…');
      try{
        const token=await bounded(clerk.session.getToken());if(!token)throw Error(t('Sign in again before saving.'));
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'save-business-details',details,ownerAccuracyConfirmed,catalogueRevision})});
        const result=await response.json();if(!response.ok)throw Error(apiError(response,result));
        await load();if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||context.business.name!==details.name||context.business.location!==details.location||context.business.details.productsServices!==details.productsServices||['email','phone','website'].some(field=>(context.business.details.customerContinuation[field]||'')!==details.customerContinuation[field]))throw Error(t('Business details changed, but could not be verified. Reload before continuing.'));
        $('business-feedback').textContent=t('Business details saved.');
      }catch(error){$('business-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);}
    });
    let mediaAttempt=null;
    function syncMediaForm(){
      const kind=$('media-kind').value;
      $('media-file').accept=kind==='image'?'image/jpeg,image/png,image/webp':'video/mp4,video/quicktime';
      $('media-upload').textContent=kind==='image'?t('Upload image'):t('Upload video');
      $('media-upload').disabled=productMutationPending||!$('media-product').options.length||!context?.business?.mediaCapabilities?.[kind==='image'?'images':'videos'];
    }
    async function changeMedia(action,item,file){
      if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id;
      mutationBusy(true);$('media-feedback').textContent=file?t('Uploading file…'):['set-main-media','resume-media'].includes(action)?submissionCopy('saving'):t('Removing media…');
      async function post(nextAction,product){
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId)throw Error(t('Your account or business changed. Reload before continuing.'));
        const token=await bounded(clerk.session.getToken());if(!token)throw Error(t('Sign in again before changing media.'));
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(90000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:nextAction,product,catalogueRevision:context?.business?.catalogueRevision})});
        const result=await response.json();if(!response.ok)throw Error(apiError(response,result));return result;
      }
      try{
        if(file){
          const registered=await post('register-media',item);
          if(clerk.user?.id!==identity||context?.business?.businessId!==businessId)throw Error(t('Your account or business changed. Reload before uploading.'));
          const upload=registered.uploadSession;
          // A failed PUT response can be ambiguous; server completion verifies the actual object.
          let transfer;try{transfer=await win.fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':item.contentType,...upload.headers},body:file,signal:win.AbortSignal.timeout(90000)});}catch{}
          if(transfer&&!transfer.ok&&![409,412].includes(transfer.status))throw Error(t('File transfer failed. Retry the upload.'));
          $('media-feedback').textContent=t('Verifying and processing file…');
          const result=await post('complete-media',{productId:item.productId,assetId:registered.assetId,storageKey:upload.storageKey,uploadToken:upload.uploadToken});
          if(result.state){await load();$('media-feedback').textContent=t('File stored; processing is not complete.');return;}
          item.assetId=registered.assetId;
        }else {const result=await post(action,item);if(result.state){await load();$('media-feedback').textContent=t('File stored; processing is not complete.');return;}}
        catalogueSnapshot='';await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden)throw Error(t('Media changed, but the dashboard could not refresh. Reload before continuing.'));
        const verified=await verifySavedBusiness(businessId,item.productId),asset=verified.media.find(a=>a.assetId===item.assetId);
        if(file?(!asset||asset.state!=='ready'||!asset.linked||!asset.previewUrl):action==='set-main-media'?!asset?.main:['resume-media','move-media'].includes(action)?!asset?.linked:Boolean(asset))throw Error(t('Could not verify the saved media change. Reload before continuing.'));
        if(file){$('media-file').value='';$('media-filename').textContent=t('No file selected.');mediaAttempt=null;}else if(action==='remove-media'&&mediaAttempt?.assetId===item.assetId)mediaAttempt=null;
        $('media-feedback').textContent=file?t('File uploaded and linked to product.'):['set-main-media','resume-media','move-media'].includes(action)?submissionCopy('saved'):t('Media removed from product.');
      }catch(error){$('media-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);}
    }
    $('media-choose').addEventListener('click',()=>$('media-file').click());
    $('media-kind').addEventListener('change',()=>{$('media-file').value='';$('media-filename').textContent=t('No file selected.');mediaAttempt=null;syncMediaForm();});
    $('media-file').addEventListener('change',()=>{$('media-filename').textContent=$('media-file').files[0]?.name||t('No file selected.');mediaAttempt=null;$('media-feedback').textContent='';});
    $('media-form').addEventListener('submit',event=>{
      event.preventDefault();const file=$('media-file').files[0],kind=$('media-kind').value,productId=$('media-product').value;
      if(!file||!productId){$('media-feedback').textContent=t('Choose a saved product and a file.');return;}
      const allowed=kind==='image'?['image/jpeg','image/png','image/webp']:['video/mp4','video/quicktime'];
      const extension=file.name.split('.').pop().toLowerCase(),types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',mov:'video/quicktime'};
      const contentType=file.type||types[extension];
      if(!allowed.includes(contentType)||file.size<1||file.size>(kind==='image'?15:250)*1024*1024){$('media-feedback').textContent=t('Choose a supported image up to 15 MB or video up to 250 MB.');return;}
      if(!mediaAttempt||mediaAttempt.file!==file||mediaAttempt.productId!==productId)mediaAttempt={file,productId,assetId:'media-'+win.crypto.randomUUID()};
      changeMedia('register-media',{productId,assetId:mediaAttempt.assetId,kind,contentType,sizeBytes:file.size},file);
    });
    for(const form of doc.querySelectorAll('form')){form.addEventListener('invalid',event=>event.target.setCustomValidity(t('Check the required fields and permitted values.')),true);form.addEventListener('input',event=>event.target.setCustomValidity?.(''));form.addEventListener('change',event=>event.target.setCustomValidity?.(''));}
    $('product-form').addEventListener('submit',event=>{
      event.preventDefault();
      const productId=$('product-id').value||('product-'+win.crypto.randomUUID());
      $('product-id').value=productId; // Retry the same record if the network response is lost.
      mutateProduct('save-product',{productId,name:$('product-name').value,sku:$('product-sku').value,description:$('product-description').value,
        priceMode:$('product-price-mode').value,price:$('product-price').value,availability:$('product-availability').value,classification:productClassification(),categoryFields:readCategoryFields()});
    });
    $('product-save-draft').addEventListener('click',()=>{const productId=$('product-id').value||('product-'+win.crypto.randomUUID());$('product-id').value=productId;mutateProduct('save-draft',{productId,name:$('product-name').value,sku:$('product-sku').value,description:$('product-description').value,priceMode:$('product-price-mode').value,price:$('product-price').value,availability:$('product-availability').value,classification:productClassification(),categoryFields:readCategoryFields()});});
    $('variant-form').addEventListener('submit',event=>{
      event.preventDefault();
      const productId=$('variant-product').value,variantId=$('variant-id').value||('variant-'+win.crypto.randomUUID());
      if(!productId)return;
      $('variant-id').value=variantId;
      mutateVariant('save-variant',{productId,variantId,name:$('variant-name').value,sku:$('variant-sku').value,price:$('variant-price').value,useBasePrice:$('variant-use-base-price').checked,availability:$('variant-availability').value});
    });
    $('variant-price').addEventListener('input',()=>{$('variant-use-base-price').checked=false;});
    $('variant-use-base-price').addEventListener('change',()=>{if($('variant-use-base-price').checked)$('variant-price').value='';});
    $('variant-product').addEventListener('change',()=>{clearVariantForm();$('variant-feedback').textContent='';});
    $('variant-cancel').addEventListener('click',()=>{clearVariantForm();$('variant-feedback').textContent='';});
    $('stock-product').addEventListener('change',()=>{
      const row=context?.business?.inventory?.rows.find(r=>JSON.stringify([r.productId,r.variantId])===$('stock-product').value);
      $('stock-quantity').value=Number.isSafeInteger(row?.onHand)?String(row.onHand):'';
      $('stock-low-stock').value=String(row?.lowStock??5);$('stock-note').value='';
      $('stock-feedback').textContent='';
    });
    $('stock-form').addEventListener('submit',async event=>{
      event.preventDefault();
      if(productMutationPending||!context?.business)return;
      const [productId,variantId]=JSON.parse($('stock-product').value||'[null,null]'),quantity=Number($('stock-quantity').value),note=$('stock-note').value.trim();
      if(!productId||!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000||!note)return;
      const businessId=context.business.businessId,catalogueRevision=context.business.catalogueRevision,inventoryRevision=context.business.inventory.revision,identity=clerk.user.id;
      mutationBusy(true);$('stock-save').disabled=true;$('stock-feedback').textContent=t('Saving stock…');
      try{
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error(t('Sign in again before changing stock.'));
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action:'adjust-stock',product:{productId,variantId,quantity,note,lowStock:Number($('stock-low-stock').value)},catalogueRevision,inventoryRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(apiError(response,result));
        catalogueSnapshot='';await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden||!$('dashboard-status').hidden||(new URLSearchParams(win.location.search).get('businessId')&&new URLSearchParams(win.location.search).get('businessId')!==businessId))throw Error(t('Stock saved, but the dashboard could not refresh.'));
        const verified=await verifySavedBusiness(businessId,productId);
        if(!verified.inventory.rows.some(r=>r.productId===productId&&r.variantId===variantId&&r.onHand===quantity))throw Error(t('Could not verify saved stock. Reload before editing again.'));
        $('stock-quantity').value='';$('stock-note').value='';$('stock-feedback').textContent=t('Stock adjustment saved.');
      }catch(error){$('stock-feedback').textContent=failureMessage(error);}
      finally{mutationBusy(false);$('stock-save').disabled=!$('stock-product').options.length;}
    });
    $('product-cancel').addEventListener('click',()=>{if(!editorDirty||win.confirm(t('Discard unsaved product changes?')))clearProductForm();});
    $('retry').addEventListener('click',()=>clerk?load():start());
    $('choose-business').addEventListener('click',()=>{clearPrivateForms();const url=new URL(win.location.href);url.searchParams.delete('businessId');win.history.pushState({},'',url);load();});
    $('sign-in').addEventListener('click',async()=>{try{const localization=await authLocalization();if(typeof clerk?.__internal_updateProps==='function')await clerk.__internal_updateProps({options:{localization}});await clerk?.openSignIn({localization,forceRedirectUrl:'/selling-vendor',fallbackRedirectUrl:'/selling-vendor',signUpForceRedirectUrl:'/selling-vendor',signUpFallbackRedirectUrl:'/selling-vendor'});}catch{status('error',t('Sign-in is temporarily unavailable'),t('Please try again.'));}});
    $('sign-out').addEventListener('click',async()=>{clearProductForm();clearPrivateForms();++sequence;controller?.abort();status('loading',t('Signing out'),t('Closing your private workspace…'));try{await clerk.signOut();await load();}catch{status('error',t('Sign-out could not finish'),t('Please retry or sign out through your account.'));}});
    $('business-select').addEventListener('change',()=>{clearPrivateForms();const id=$('business-select').value;if(!context?.businesses.some(b=>b.businessId===id))return;const url=new URL(win.location.href);url.searchParams.set('businessId',id);win.history.pushState({},'',url);load();});
    doc.querySelector('nav').addEventListener('click',event=>{
      const link=event.target.closest('a[data-section]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(productMutationPending)return;win.history.pushState({},'',link.getAttribute('href'));load();$('main').focus();
    });
    win.addEventListener('popstate',load);
    win.addEventListener('pageshow',event=>{if(event.persisted)load();});
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){++sequence;controller?.abort();status('loading',t('Workspace paused'),t('Business access will be checked when you return.'));}else if(clerk)load();});
    return {start,load};
  }
  return {sections,sectionForPath,createDashboard};
});