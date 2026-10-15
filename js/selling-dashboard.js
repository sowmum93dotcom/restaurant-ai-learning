(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document){root.DEMEOSSellingDashboard=api;api.createDashboard(root).start();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const sections=Object.freeze({
    overview:['Overview','Your saved business at a glance','These counts come from saved products, variants, inventory and recent private orders for this business.'],
    'my-business':['My Business','Your saved business','These details come from your existing business record. Registration and approval continue through the existing business workflow.'],
    'product-catalogue':['Product Catalogue','Catalogue tools are being prepared','Product creation and editing are not available in this dashboard yet. Existing product records remain saved.'],
    'images-videos':['Images & Videos','Product images and videos','Upload actual files, review processing status and remove media belonging to your products.'],
    'options-variants':['Options & Variants','Manage product variants','Add, edit and remove saved variants for your catalogue products.'],
    'stock-history':['Stock & History','Stock tools are not available yet','Stock adjustments and their audit history will appear here in a later phase. No stock changes can be made here yet.'],
    'private-orders':['Private Orders','Your private orders','View the real saved order records belonging to this business.']
  });
  const turkish=Object.freeze({
    overview:['Genel Bakış','Satış çalışma alanınıza hoş geldiniz','Kimliğiniz ve satış erişiminiz doğrulandı. Devam etmek için bir bölüm seçin.'],
    'my-business':['İşletmem','Kayıtlı işletmeniz','Bu bilgiler mevcut DEMEOS işletme kaydınızdan alınır.'],
    'product-catalogue':['Ürün Kataloğu','Katalog araçları hazırlanıyor','Ürün oluşturma ve düzenleme henüz kullanılamıyor. Mevcut ürünleriniz korunur.'],
    'images-videos':['Görseller ve Videolar','Medya araçları henüz kullanılamıyor','Görsel ve video yükleme daha sonraki aşamada bağlanacak.'],
    'options-variants':['Seçenekler ve Varyantlar','Varyantları yönetin','Katalog ürünleriniz için kayıtlı varyantları ekleyin, düzenleyin veya silin.'],
    'stock-history':['Stok ve Geçmiş','Stok araçları henüz kullanılamıyor','Stok değişiklikleri ve geçmişi daha sonraki aşamada burada görünecek.'],
    'private-orders':['Özel Siparişler','Sipariş araçları henüz kullanılamıyor','Özel siparişler, sipariş sistemi bağlanıp doğrulandıktan sonra burada görünecek.']
  });
  const localizedSections=language=>language==='tr'?turkish:sections;
  function sectionForPath(path){
    if(['/selling-vendor','/selling-vendor/','/selling-dashboard.html'].includes(path))return 'overview';
    const match=path.match(/^\/selling-vendor\/([^/]+)\/?$/);
    return match&&Object.hasOwn(sections,match[1])?match[1]:null;
  }
  function createDashboard(win){
    const doc=win.document,$=id=>doc.getElementById(id);
    let clerk=null,sequence=0,controller=null,context=null,sessionKey=null,booting=false;
    const currentSection=()=>sectionForPath(win.location.pathname);
    let language='en',renderedContextKey='';
    const sectionCopy=()=>localizedSections(language);
    function translateNavigation(){for(const link of doc.querySelectorAll('nav [data-section]'))link.textContent=sectionCopy()[link.dataset.section][0];$('dashboard-language').value=language;doc.documentElement.lang=language;}
    function status(state,title,message){
      context=null;$('private-workspace').hidden=true;$('business-name').textContent='';$('business-details').textContent='';$('business-facts').replaceChildren();$('business-select').replaceChildren();
      $('dashboard-status').hidden=false;$('dashboard-status').dataset.state=state;
      $('dashboard-status').setAttribute('aria-busy',String(state==='loading'));
      $('status-heading').textContent=title;$('status-message').textContent=message;
      $('retry').hidden=!['error','denied','empty'].includes(state);
      $('registration').hidden=!['empty','denied'].includes(state);
      $('choose-business').hidden=state!=='denied';
    }
    function navigation(){
      const section=currentSection();translateNavigation();$('section-heading').textContent=sectionCopy()[section]?.[0]||'Page not found';
      for(const link of doc.querySelectorAll('nav [data-section]')){
        if(link.dataset.section===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
        const url=new URL(link.getAttribute('href'),win.location.origin),businessId=new URLSearchParams(win.location.search).get('businessId');
        if(businessId)url.searchParams.set('businessId',businessId);else url.searchParams.delete('businessId');
        link.setAttribute('href',url.pathname+url.search);
      }
      return section;
    }
    function bounded(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(Error('timeout')),15000);})]).finally(()=>win.clearTimeout(timer));}
    async function request(url,signal){
      for(let attempt=0;attempt<2;attempt++){
        const token=await bounded(clerk.session?.getToken({skipCache:attempt===1})||Promise.resolve(null));
        const response=await win.fetch(url,{credentials:'same-origin',cache:'no-store',signal,headers:token?{Authorization:'Bearer '+token}:{}});
        if(response.status!==401||attempt===1)return response;
      }
    }
    function render(data){
      if(data.contractVersion!==1||!data.vendor?.identityId||data.vendor.identityId!==clerk.user?.id||!Array.isArray(data.businesses))throw Error('Invalid context');
      const selected=new URLSearchParams(win.location.search).get('businessId');
      if(data.business&&(selected&&selected!==data.business.businessId||!data.businesses.some(b=>b.businessId===data.business.businessId)))throw Error('Invalid business');
      const ids=new Set();
      for(const business of data.businesses){if(!business?.businessId||ids.has(business.businessId)||!['live','test'].includes(business.dataEnvironment))throw Error('Invalid business list');ids.add(business.businessId);}
      if(!data.businesses.length){status('empty','No authorized Selling business yet','This account has no business with Selling access in this environment. Contact the business administrator to confirm access.');return;}
      const renderKey=data.vendor.identityId+':'+(data.business?.businessId||'');if(renderedContextKey!==renderKey){clearPrivateForms();renderedContextKey=renderKey;}
      context=data;$('dashboard-status').hidden=true;$('private-workspace').hidden=false;
      $('business-select').replaceChildren();
      if(!data.business){const placeholder=doc.createElement('option');placeholder.value='';placeholder.textContent='Choose your business';$('business-select').append(placeholder);}
      for(const business of data.businesses){const option=doc.createElement('option');option.value=business.businessId;option.textContent=business.name;$('business-select').append(option);}
      $('business-select').value=data.business?.businessId||'';
      $('business-select').disabled=data.businesses.length===1;
      const business=data.business;
      $('business-name').textContent=business?.name||'Choose a business';
      $('business-details').textContent=business?[business.type,business.location].filter(Boolean).join(' · '):'Only businesses authorized for your account are listed.';
      $('environment-label').textContent=business?(business.dataEnvironment==='test'?'Test business · isolated data':'Selling access approved'):'';
      $('environment-label').dataset.environment=business?.dataEnvironment||'';
      const section=currentSection(),copy=sectionCopy()[section];
      $('content-heading').textContent=business?copy[1]:'Select your business to continue';
      $('content-message').textContent=business?copy[2]:'Use the business selector above. Your choice is kept in the page URL for refresh and direct navigation.';
      const catalogue=$('catalogue-list');
      catalogue.replaceChildren();
      $('catalogue-tools').hidden=section!=='product-catalogue'||!business;
      catalogue.hidden=section!=='product-catalogue'||!business;
      if(section==='product-catalogue'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent=language==='tr'?'Ürün Kataloğu':'Product Catalogue';
        $('content-message').textContent=products.length?(language==='tr'?'Kayıtlı ürünleriniz':'Your saved DEMEOS products'):(language==='tr'?'Henüz kayıtlı ürün yok.':'No products saved yet.');
        for(const product of products){
          const item=doc.createElement('article');item.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=product.name||'Unnamed product';
          const description=doc.createElement('p');description.textContent=product.description||'';
          const price=doc.createElement('p');price.textContent=product.price||'Contact for price';
          const availability=doc.createElement('p');availability.textContent=product.availability==='available'?'Available':product.availability==='unavailable'?'Unavailable':product.availability==='limited'?'Limited availability':'Ask about availability';
          const edit=doc.createElement('button');edit.type='button';edit.textContent='Edit';
          edit.addEventListener('click',()=>{ $('product-id').value=product.productId;$('product-name').value=product.name||'';$('product-description').value=product.description||'';$('product-price-mode').value=product.priceMode||'contact';$('product-price').value=product.price||'';syncProductPrice();$('product-availability').value=product.availability||'contact';$('product-form-title').textContent='Edit product';$('product-name').focus(); });
          const remove=doc.createElement('button');remove.type='button';remove.textContent='Delete';
          remove.addEventListener('click',()=>{if(win.confirm('Delete this product?'))mutateProduct('delete-product',{productId:product.productId});});
          item.append(title,description,price,availability,edit,remove);catalogue.append(item);
        }
      }
      $('media-tools').hidden=section!=='images-videos'||!business;
      $('media-product').replaceChildren();$('media-list').replaceChildren();
      if(section==='images-videos'&&business){
        for(const product of business.products||[]){const option=doc.createElement('option');option.value=product.productId;option.textContent=product.name;$('media-product').append(option);}
        $('media-configuration').textContent=business.mediaCapabilities.blocker;
        for(const asset of business.media||[]){
          const article=doc.createElement('article');article.className='catalogue-item';article.dataset.assetId=asset.assetId;
          const title=doc.createElement('h3');title.textContent=(business.products.find(p=>p.productId===asset.productId)?.name||'Product')+' · '+asset.kind;
          const state=doc.createElement('p');state.textContent=asset.state+(asset.linked?' · Linked to product':' · Not linked')+(asset.failureReason?' · '+asset.failureReason:'');article.append(title,state);
          if(asset.state==='ready'&&asset.previewUrl){const preview=doc.createElement(asset.kind==='image'?'img':'video');preview.src=asset.previewUrl;preview.className='product-media-preview';if(asset.kind==='image')preview.alt=title.textContent;else{preview.controls=true;preview.preload='metadata';}article.append(preview);}
          const remove=doc.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>{if(win.confirm('Remove this media from the product?'))changeMedia('remove-media',{productId:asset.productId,assetId:asset.assetId});});article.append(remove);$('media-list').append(article);
        }
        if(!business.media?.length){const empty=doc.createElement('p');empty.textContent='No product media saved.';$('media-list').append(empty);}
        syncMediaForm();
      }
      $('variant-tools').hidden=section!=='options-variants'||!business;
      $('variant-product').replaceChildren();
      $('variant-list').replaceChildren();
      if(section==='options-variants'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent=sectionCopy()['options-variants'][1];
        $('content-message').textContent=products.length?sectionCopy()['options-variants'][2]:(language==='tr'?'Varyantları yönetmeden önce Ürün Kataloğuna ürün ekleyin.':'Add products in Product Catalogue before managing variants.');
        for(const product of products){
          const option=doc.createElement('option');option.value=product.productId;option.textContent=product.name||product.productId;$('variant-product').append(option);
          const article=doc.createElement('article');article.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=product.name||'Unnamed product';article.append(title);
          const variants=Array.isArray(product.variants)?product.variants:[];
          if(!variants.length){const empty=doc.createElement('p');empty.textContent=language==='tr'?'Kayıtlı varyant yok.':'No variants saved.';article.append(empty);}
          for(const variant of variants){
            const row=doc.createElement('div');row.className='variant-item';
            const name=doc.createElement('strong');name.textContent=variant.name||'Unnamed variant';
            const detail=doc.createElement('span');detail.textContent=[variant.sku?('SKU: '+variant.sku):'',variant.price?('Price: '+variant.price):'',variant.availability==='available'?'Available':variant.availability==='unavailable'?'Unavailable':variant.availability==='limited'?'Limited availability':'Ask about availability'].filter(Boolean).join(' · ');
            const edit=doc.createElement('button');edit.type='button';edit.textContent='Edit';
            edit.addEventListener('click',()=>{$('variant-product').value=product.productId;$('variant-id').value=variant.variantId;$('variant-name').value=variant.name||'';$('variant-sku').value=variant.sku||'';$('variant-price').value=variant.price||'';$('variant-use-base-price').checked=variant.inheritsPrice===true;$('variant-current-price').textContent=variant.structuredPrice?'Existing structured price: '+variant.structuredPrice+'. Leave the override blank to retain it, or select the product price.':'';$('variant-availability').value=variant.availability||'contact';$('variant-form-title').textContent='Edit variant';$('variant-name').focus();});
            const remove=doc.createElement('button');remove.type='button';remove.textContent='Delete';
            remove.addEventListener('click',()=>{if(win.confirm('Delete this variant?'))mutateVariant('delete-variant',{productId:product.productId,variantId:variant.variantId});});
            row.append(name,detail,edit,remove);article.append(row);
          }
          $('variant-list').append(article);
        }
        $('variant-save').disabled=!products.length;
      }
      $('stock-tools').hidden=section!=='stock-history'||!business;
      $('stock-product').replaceChildren();
      $('stock-list').replaceChildren();
      if(section==='stock-history'&&business){
        const products=Array.isArray(business.products)?business.products:[];
        $('content-heading').textContent='Stock & History';
        $('content-message').textContent=products.length?'Set stock quantities and review the latest 30 ledger events. Earlier audit history remains stored.':'Add products in Product Catalogue before managing stock.';
        const rows=business.inventory?.rows||[];
        for(const row of rows){
          const option=doc.createElement('option');option.value=JSON.stringify([row.productId,row.variantId]);option.textContent=[row.name,row.label].filter(Boolean).join(' · ');$('stock-product').append(option);
          const article=doc.createElement('article');article.className='catalogue-item';
          const title=doc.createElement('h3');title.textContent=option.textContent;
          const count=doc.createElement('p');count.textContent='Quantity: '+(row.onHand??'Not set')+' · Reserved: '+row.reserved;article.append(title,count);
          for(const batch of business.inventory.history||[])for(const event of batch.changes||[]){
            if(event.productId!==row.productId||(event.variantId||'')!==row.variantId)continue;
            const line=doc.createElement('p');line.textContent=new Date(batch.recorded_at).toLocaleString()+' · '+(event.event?('Order '+event.event+' · Reserved '+event.beforeReserved+' → '+event.afterReserved):(event.before??'Not set')+' → '+event.after+' · '+event.reason)+' · '+batch.trusted_identity_id;article.append(line);
          }
          for(const event of (products.find(p=>p.productId===row.productId)?.stockHistory||[]).slice().reverse()){
            const line=doc.createElement('p');line.textContent='Earlier record · '+event.changedAt+' · '+(event.from??'Not set')+' → '+event.to+' · '+event.note;article.append(line);
          }
          $('stock-list').append(article);
        }
        $('stock-save').disabled=!rows.length;
        const row=rows.find(r=>JSON.stringify([r.productId,r.variantId])===$('stock-product').value);
        $('stock-quantity').value=row?.onHand===null||!row?'':String(row.onHand);
      }
      $('business-tools').hidden=section!=='my-business'||!business;
      if(section==='my-business'&&business){$('business-edit-name').value=business.name;$('business-edit-location').value=business.location;$('business-edit-description').value=business.details.productsServices;$('business-accuracy').checked=false;}
      $('overview-facts').hidden=section!=='overview'||!business;$('overview-facts').replaceChildren();
      if(section==='overview'&&business)for(const [key,label] of [['products','Saved products'],['availableProducts','Available products'],['variants','Saved variants'],['trackedStockRows','Tracked stock rows'],['recentOrders','Recent private orders (up to 50)']]){const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=String(business.summary[key]);dd.dataset.metric=key;$('overview-facts').append(dt,dd);}
      $('orders-tools').hidden=section!=='private-orders'||!business;$('orders-list').replaceChildren();
      if(section==='private-orders'&&business){
        if(!business.orders.length){const empty=doc.createElement('p');empty.textContent='No private orders saved for this business.';$('orders-list').append(empty);}
        for(const order of business.orders){
          const details=doc.createElement('details');details.className='catalogue-item';const heading=doc.createElement('summary');heading.textContent='Order '+order.id+' · '+order.state;details.append(heading);
          for(const [label,value] of [['Created',order.createdAt],['Reservation expiry',order.expiresAt],['Product',order.line.name],['Product ID',order.line.productId],['Variant ID',order.line.variantId||'None'],['Quantity',order.line.quantity],['Currency',order.line.currency],['Total (minor units)',order.line.totalPriceMinor],['Payment',order.paymentState]]){const line=doc.createElement('p');line.textContent=label+': '+value;details.append(line);}
          $('orders-list').append(details);
        }
      }
      $('business-facts').hidden=section!=='my-business'||!business;
      $('business-facts').replaceChildren();
      if(section==='my-business'&&business)for(const [label,value] of [['Business ID',business.businessId],['Business name',business.name],['Business type',business.type||'Not provided'],['Location',business.location||'Not provided'],['Selling access',business.dataEnvironment==='test'?'Test access authorized':'Approved'],['Description',business.details.productsServices||'Not provided'],['Email',business.details.customerContinuation.email||'Not provided'],['Phone',business.details.customerContinuation.phone||'Not provided'],['Website',business.details.customerContinuation.website||'Not provided']]){
        const term=doc.createElement('dt'),detail=doc.createElement('dd');term.textContent=label;detail.textContent=value;$('business-facts').append(term,detail);
      }
    }
    async function load(){
      const turn=++sequence;controller?.abort();controller=new AbortController();
      if(!navigation()){status('error','Page not found','Choose a dashboard section from the navigation.');return;}
      $('sign-in').hidden=Boolean(clerk?.user);$('sign-out').hidden=!clerk?.user;
      $('vendor-identity').textContent=clerk?.user?(clerk.user.fullName||clerk.user.primaryEmailAddress?.emailAddress||'Business account'):'';
      if(!clerk?.user){status(clerk?.session?'loading':'signed-out',clerk?.session?'Restoring your session':'Sign in to your Selling dashboard',clerk?.session?'Checking your current account…':'Use your existing DEMEOS business account. Access is checked against your saved business ownership and server-authorized Selling access.');return;}
      const identity=clerk.user.id;
      status('loading','Loading your business','Checking your saved ownership and Selling access…');
      const url=new URL('/api/businesses',win.location.origin);url.searchParams.set('resource','selling-dashboard');
      const selected=new URLSearchParams(win.location.search).get('businessId');if(selected)url.searchParams.set('businessId',selected);
      const requestController=controller,timeout=win.setTimeout(()=>requestController.abort(),15000);
      try{
        const response=await request(url.pathname+url.search,requestController.signal);
        if(turn!==sequence||identity!==clerk.user?.id)return;
        if(response.status===401){status('denied','Your session needs sign-in','Sign in again to restore access.');$('sign-in').hidden=false;return;}
        if(response.status===403){status('denied','Selling access unavailable','This business is not authorized for your account in this environment. Choose an authorized business, or contact the business administrator.');return;}
        if(!response.ok)throw Error('Context unavailable');
        const data=await response.json();if(turn===sequence&&identity===clerk.user?.id)render(data);
      }catch{if(turn===sequence)status('error','Could not open your dashboard','Your business information could not be loaded. Check your connection and try again.');}
      finally{win.clearTimeout(timeout);}
    }
    async function script(src,key){
      return bounded(new Promise((resolve,reject)=>{const node=doc.createElement('script');node.src=src;node.async=true;node.crossOrigin='anonymous';if(key)node.dataset.clerkPublishableKey=key;node.onload=resolve;node.onerror=()=>{node.remove();reject(Error('Authentication SDK unavailable'));};doc.head.append(node);}));
    }
    async function start(){
      if(booting)return;booting=true;navigation();status('loading','Opening your workspace','Checking your session and business access…');
      try{
        const response=await bounded(win.fetch('/api/public-config',{credentials:'same-origin',cache:'no-store'}));
        if(!response.ok)throw Error('Authentication configuration unavailable');
        const config=await response.json(),key=config.clerkPublishableKey;
        if(typeof key!=='string'||!/^pk_(test|live)_/.test(key))throw Error('Invalid authentication configuration');
        const domain=win.atob(key.split('_')[2]).replace(/\$$/,'');
        if(!/^[a-z0-9.-]+$/i.test(domain))throw Error('Invalid authentication domain');
        if(!win.__internal_ClerkUICtor)await script('https://'+domain+'/npm/@clerk/ui@1/dist/ui.browser.js');
        if(!win.Clerk)await script('https://'+domain+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js',key);
        const candidate=win.Clerk;await bounded(candidate.load({ui:{ClerkUI:win.__internal_ClerkUICtor}}));clerk=candidate;
        if(new URLSearchParams(win.location.search).get('clerk_oauth_callback')==='1')await bounded(clerk.handleRedirectCallback({signInForceRedirectUrl:'/selling-vendor',signUpForceRedirectUrl:'/selling-vendor',signInFallbackRedirectUrl:'/selling-vendor',signUpFallbackRedirectUrl:'/selling-vendor'}));
        clerk.addListener(()=>{
          const key=(clerk.user?.id||'')+':'+(clerk.session?.id||'');
          if(key!==sessionKey){clearPrivateForms();sessionKey=key;load();}
        });
        sessionKey=(clerk.user?.id||'')+':'+(clerk.session?.id||'');await load();
      }catch{clerk=null;status('error','Sign-in is temporarily unavailable','We could not connect to DEMEOS authentication. Please try again.');}
      finally{booting=false;}
    }
    $('dashboard-language').addEventListener('change',()=>{language=$('dashboard-language').value==='tr'?'tr':'en';navigation();if(context?.business)render(context);});
    function clearPrivateForms(){
      clearProductForm();clearVariantForm();
      for(const id of ['stock-form','media-form','business-form'])$(id).reset();
      for(const id of ['product-feedback','variant-feedback','stock-feedback','media-feedback','business-feedback'])$(id).textContent='';
      mediaAttempt=null;
    }
    function syncProductPrice(){
      const contact=$('product-price-mode').value==='contact';
      $('product-price').disabled=contact;
      $('product-price').required=!contact;
      if(contact)$('product-price').value='';
    }
    $('product-price-mode').addEventListener('change',syncProductPrice);
    function clearProductForm(){
      $('product-form').reset();$('product-id').value='';$('product-form-title').textContent='Add product';syncProductPrice();
    }
    function clearVariantForm(){
      const productId=$('variant-product').value;
      $('variant-form').reset();$('variant-current-price').textContent='';$('variant-id').value='';$('variant-form-title').textContent='Add variant';
      if(productId&&Array.from($('variant-product').options).some(option=>option.value===productId))$('variant-product').value=productId;
    }
    syncProductPrice();
    let productMutationPending=false;
    function mutationBusy(busy){
      productMutationPending=busy;
      for(const control of doc.querySelectorAll('#catalogue-tools input,#catalogue-tools textarea,#catalogue-tools select,#catalogue-tools button,#catalogue-list button,#variant-tools input,#variant-tools select,#variant-tools button,#stock-tools input,#stock-tools select,#stock-tools button,#media-tools input,#media-tools select,#media-tools button,#business-tools input,#business-tools textarea,#business-tools button'))control.disabled=busy;
      $('business-select').disabled=busy||context?.businesses.length===1;
      if(!busy){syncProductPrice();syncMediaForm();$('variant-save').disabled=!$('variant-product').options.length;$('stock-save').disabled=!$('stock-product').options.length;}
    }
    async function mutateProduct(action,product){
      if(productMutationPending)return;
      const businessId=context?.business?.businessId;
      if(!businessId)return;
      const catalogueRevision=context.business.catalogueRevision,identity=clerk.user.id;
      mutationBusy(true);
      const button=$('product-save');button.disabled=true;
      $('product-cancel').disabled=true;
      for(const control of $('catalogue-list').querySelectorAll('button'))control.disabled=true;
      $('product-feedback').textContent=action==='delete-product'?'Deleting…':'Saving…';
      try{
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error('Sign in again before changing products.');
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action,product,catalogueRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(result.error||'Could not save product.');
        await load();
        const selectedAfterSave=new URLSearchParams(win.location.search).get('businessId');
        if(!context?.business||context.business.businessId!==businessId||
          (selectedAfterSave&&selectedAfterSave!==businessId)||clerk.user?.id!==identity||
          !$('dashboard-status').hidden||$('private-workspace').hidden)
          throw Error('Product saved, but the dashboard could not refresh. Reload before editing again.');
        const confirmed=context.business.products.find(p=>p.productId===product.productId);
        if(action==='delete-product'?Boolean(confirmed):!confirmed||['name','description','priceMode','price','availability'].some(k=>product[k]!==undefined&&confirmed[k]!==product[k].trim()))throw Error('Could not verify the product change. Reload before editing again.');
        clearProductForm();$('product-feedback').textContent=action==='delete-product'?'Product deleted.':'Product saved.';
      }catch(error){$('product-feedback').textContent=error.message||'Product change failed.';}
      finally{mutationBusy(false);button.disabled=false;$('product-cancel').disabled=false;
        for(const control of $('catalogue-list').querySelectorAll('button'))control.disabled=false;}
    }
    async function mutateVariant(action,product){
      if(productMutationPending)return;
      const businessId=context?.business?.businessId;
      if(!businessId)return;
      const catalogueRevision=context.business.catalogueRevision,identity=clerk.user.id;
      mutationBusy(true);
      $('variant-save').disabled=true;$('variant-cancel').disabled=true;
      for(const control of $('variant-list').querySelectorAll('button'))control.disabled=true;
      $('variant-feedback').textContent=action==='delete-variant'?'Deleting variant…':'Saving variant…';
      try{
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error('Sign in again before changing variants.');
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action,product,catalogueRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(result.error||'Variant change failed.');
        await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden||!$('dashboard-status').hidden||(new URLSearchParams(win.location.search).get('businessId')&&new URLSearchParams(win.location.search).get('businessId')!==businessId))
          throw Error('Variant saved, but the dashboard could not refresh.');
        const confirmed=context.business.products.find(p=>p.productId===product.productId)?.variants.find(v=>v.variantId===product.variantId);
        if(action==='delete-variant'?Boolean(confirmed):!confirmed||['name','sku','price','availability'].some(k=>k==='price'&&product.price&&confirmed.price?Number(confirmed.price)!==Number(product.price):confirmed[k]!==product[k].trim()))throw Error('Could not verify the variant change. Reload before editing again.');
        clearVariantForm();$('variant-feedback').textContent=action==='delete-variant'?'Variant deleted.':'Variant saved.';
      }catch(error){$('variant-feedback').textContent=error.message||'Variant change failed.';}
      finally{mutationBusy(false);$('variant-save').disabled=!$('variant-product').options.length;$('variant-cancel').disabled=false;
        for(const control of $('variant-list').querySelectorAll('button'))control.disabled=false;}
    }
    $('business-form').addEventListener('submit',async event=>{
      event.preventDefault();if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id,catalogueRevision=context.business.catalogueRevision;
      const details={name:$('business-edit-name').value.trim(),location:$('business-edit-location').value.trim(),productsServices:$('business-edit-description').value.trim()},ownerAccuracyConfirmed=$('business-accuracy').checked;
      mutationBusy(true);$('business-feedback').textContent='Saving business details…';
      try{
        const token=await bounded(clerk.session.getToken());if(!token)throw Error('Sign in again before saving.');
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'save-business-details',details,ownerAccuracyConfirmed,catalogueRevision})});
        const result=await response.json();if(!response.ok)throw Error(result.error||'Business details could not be saved.');
        await load();if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||context.business.name!==details.name||context.business.location!==details.location||context.business.details.productsServices!==details.productsServices)throw Error('Business details changed, but could not be verified. Reload before continuing.');
        $('business-feedback').textContent='Business details saved.';
      }catch(error){$('business-feedback').textContent=error.message||'Business details could not be saved.';}
      finally{mutationBusy(false);}
    });
    let mediaAttempt=null;
    function syncMediaForm(){
      const kind=$('media-kind').value;
      $('media-file').accept=kind==='image'?'image/jpeg,image/png,image/webp':'video/mp4,video/quicktime';
      $('media-upload').textContent=kind==='image'?'Upload image':'Upload video';
      $('media-upload').disabled=productMutationPending||!$('media-product').options.length||!context?.business?.mediaCapabilities?.[kind==='image'?'images':'videos'];
    }
    async function changeMedia(action,item,file){
      if(productMutationPending||!context?.business)return;
      const businessId=context.business.businessId,identity=clerk.user.id;
      mutationBusy(true);$('media-feedback').textContent=file?'Uploading file…':'Removing media…';
      async function post(nextAction,product){
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId)throw Error('Your account or business changed. Reload before continuing.');
        const token=await bounded(clerk.session.getToken());if(!token)throw Error('Sign in again before changing media.');
        const response=await win.fetch('/api/businesses?resource=selling-dashboard&businessId='+encodeURIComponent(businessId),{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(90000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:nextAction,product,catalogueRevision:context?.business?.catalogueRevision})});
        const result=await response.json();if(!response.ok)throw Error(result.error||'Media change failed.');return result;
      }
      try{
        if(file){
          const registered=await post('register-media',item);
          if(clerk.user?.id!==identity||context?.business?.businessId!==businessId)throw Error('Your account or business changed. Reload before uploading.');
          const upload=registered.uploadSession;
          // A failed PUT response can be ambiguous; server completion verifies the actual object.
          try{await win.fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file,signal:win.AbortSignal.timeout(90000)});}catch{}
          $('media-feedback').textContent='Verifying and processing file…';
          const result=await post('complete-media',{productId:item.productId,assetId:registered.assetId,storageKey:upload.storageKey,uploadToken:upload.uploadToken});
          if(result.state){await load();$('media-feedback').textContent=result.message||'File stored; processing is not complete.';return;}
          item.assetId=registered.assetId;
        }else await post(action,item);
        await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden)throw Error('Media changed, but the dashboard could not refresh. Reload before continuing.');
        const asset=context.business.media.find(a=>a.assetId===item.assetId);
        if(file?(!asset||asset.state!=='ready'||!asset.linked||!asset.previewUrl):Boolean(asset))throw Error('Could not verify the saved media change. Reload before continuing.');
        if(file){$('media-file').value='';mediaAttempt=null;}
        $('media-feedback').textContent=file?'File uploaded and linked to product.':'Media removed from product.';
      }catch(error){$('media-feedback').textContent=error.message||'Media change failed.';}
      finally{mutationBusy(false);}
    }
    $('media-kind').addEventListener('change',()=>{$('media-file').value='';mediaAttempt=null;syncMediaForm();});
    $('media-file').addEventListener('change',()=>{mediaAttempt=null;$('media-feedback').textContent='';});
    $('media-form').addEventListener('submit',event=>{
      event.preventDefault();const file=$('media-file').files[0],kind=$('media-kind').value,productId=$('media-product').value;
      if(!file||!productId)return;
      if(!mediaAttempt||mediaAttempt.file!==file||mediaAttempt.productId!==productId)mediaAttempt={file,productId,assetId:'media-'+win.crypto.randomUUID()};
      changeMedia('register-media',{productId,assetId:mediaAttempt.assetId,kind,contentType:file.type,sizeBytes:file.size},file);
    });
    $('product-form').addEventListener('submit',event=>{
      event.preventDefault();
      const productId=$('product-id').value||('product-'+win.crypto.randomUUID());
      $('product-id').value=productId; // Retry the same record if the network response is lost.
      mutateProduct('save-product',{productId,name:$('product-name').value,description:$('product-description').value,
        priceMode:$('product-price-mode').value,price:$('product-price').value,availability:$('product-availability').value});
    });
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
      $('stock-note').value='';
      $('stock-feedback').textContent='';
    });
    $('stock-form').addEventListener('submit',async event=>{
      event.preventDefault();
      if(productMutationPending||!context?.business)return;
      const [productId,variantId]=JSON.parse($('stock-product').value||'[null,null]'),quantity=Number($('stock-quantity').value),note=$('stock-note').value.trim();
      if(!productId||!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000||!note)return;
      const businessId=context.business.businessId,catalogueRevision=context.business.catalogueRevision,inventoryRevision=context.business.inventory.revision,identity=clerk.user.id;
      mutationBusy(true);$('stock-save').disabled=true;$('stock-feedback').textContent='Saving stock…';
      try{
        const token=await bounded(clerk.session?.getToken()||Promise.resolve(null));
        if(!token)throw Error('Sign in again before changing stock.');
        const url=new URL('/api/businesses',win.location.origin);
        url.searchParams.set('resource','selling-dashboard');url.searchParams.set('businessId',businessId);
        const response=await win.fetch(url.pathname+url.search,{method:'POST',credentials:'same-origin',signal:win.AbortSignal.timeout(30000),
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({action:'adjust-stock',product:{productId,variantId,quantity,note},catalogueRevision,inventoryRevision})});
        const result=await response.json();
        if(!response.ok)throw Error(result.error||'Stock adjustment failed.');
        await load();
        if(clerk.user?.id!==identity||context?.business?.businessId!==businessId||$('private-workspace').hidden||!$('dashboard-status').hidden||(new URLSearchParams(win.location.search).get('businessId')&&new URLSearchParams(win.location.search).get('businessId')!==businessId))throw Error('Stock saved, but the dashboard could not refresh.');
        if(!context.business.inventory.rows.some(r=>r.productId===productId&&r.variantId===variantId&&r.onHand===quantity))throw Error('Could not verify saved stock. Reload before editing again.');
        $('stock-quantity').value='';$('stock-note').value='';$('stock-feedback').textContent='Stock adjustment saved.';
      }catch(error){$('stock-feedback').textContent=error.message||'Stock adjustment failed.';}
      finally{mutationBusy(false);$('stock-save').disabled=!$('stock-product').options.length;}
    });
    $('product-cancel').addEventListener('click',clearProductForm);
    $('retry').addEventListener('click',()=>clerk?load():start());
    $('choose-business').addEventListener('click',()=>{clearPrivateForms();const url=new URL(win.location.href);url.searchParams.delete('businessId');win.history.pushState({},'',url);load();});
    $('sign-in').addEventListener('click',async()=>{try{await clerk?.openSignIn({forceRedirectUrl:'/selling-vendor',fallbackRedirectUrl:'/selling-vendor',signUpForceRedirectUrl:'/selling-vendor',signUpFallbackRedirectUrl:'/selling-vendor'});}catch{status('error','Sign-in is temporarily unavailable','Please try again.');}});
    $('sign-out').addEventListener('click',async()=>{clearPrivateForms();++sequence;controller?.abort();status('loading','Signing out','Closing your private workspace…');try{await clerk.signOut();await load();}catch{status('error','Sign-out could not finish','Please retry or sign out through your account.');}});
    $('business-select').addEventListener('change',()=>{clearPrivateForms();const id=$('business-select').value;if(!context?.businesses.some(b=>b.businessId===id))return;const url=new URL(win.location.href);url.searchParams.set('businessId',id);win.history.pushState({},'',url);load();});
    doc.querySelector('nav').addEventListener('click',event=>{
      const link=event.target.closest('a[data-section]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(productMutationPending)return;win.history.pushState({},'',link.getAttribute('href'));load();$('main').focus();
    });
    win.addEventListener('popstate',load);
    win.addEventListener('pageshow',event=>{if(event.persisted)load();});
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){++sequence;controller?.abort();status('loading','Workspace paused','Business access will be checked when you return.');}else if(clerk)load();});
    return {start,load};
  }
  return {sections,sectionForPath,createDashboard};
});