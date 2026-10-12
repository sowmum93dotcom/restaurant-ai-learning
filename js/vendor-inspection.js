(function(root){
  'use strict';
  const bootstrap=root.DEMEOS_VENDOR_INSPECTION;
  if(!bootstrap || !/^\/selling-vendor\/inspect(?:\/manage)?$/.test(root.location.pathname))return;
  const nativeFetch=root.fetch.bind(root),nativeLocal=root.localStorage,nativeSession=root.sessionStorage;
  const prefix='demeos:vendor-inspection:705:'+bootstrap.identityId+':';
  const localUrls=new Set();
  const storage=original=>{
    const target=key=>String(key).startsWith('demeos')&&key!=='demeos-customer-language'?[nativeSession,prefix+key]:[original,key];
    return {getItem(key){const [store,id]=target(key);return store.getItem(id);},setItem(key,value){const [store,id]=target(key);store.setItem(id,String(value));},removeItem(key){const [store,id]=target(key);store.removeItem(id);},clear(){for(let i=nativeSession.length-1;i>=0;i--){const key=nativeSession.key(i);if(key?.startsWith(prefix))nativeSession.removeItem(key);}},key:i=>original.key(i),get length(){return original.length;}};
  };
  // Isolate DEMEOS inspection caches; preserve Clerk's existing storage and session.
  Object.defineProperty(root,'localStorage',{value:storage(nativeLocal)});
  Object.defineProperty(root,'sessionStorage',{value:storage(nativeSession)});
  let state=bootstrap.state;
  try{const saved=JSON.parse(nativeSession.getItem(prefix+'sandbox')||'null');if(saved?.profile?.businessId===state.profile.businessId&&!saved.profile.applicationAccess)state=saved;}catch(_){}
  for(const asset of state.assets){const current=bootstrap.state.assets.find(item=>item.assetId===asset.assetId);if(current){asset.deliveryUrl=current.deliveryUrl;asset.originalFilename=current.originalFilename;}}
  for(const asset of state.assets)if(/^data:(?:image|video)\//.test(asset.deliveryUrl||''))localUrls.add(asset.deliveryUrl);
  const save=()=>{try{nativeSession.setItem(prefix+'sandbox',JSON.stringify(state));}catch(_){/* Large files are page-local; preserve the smaller catalogue and stock sandbox. */
    const durable=structuredClone(state);durable.assets=durable.assets.filter(asset=>!asset.assetId.startsWith('test-upload-')||(asset.state==='ready'&&asset.deliveryUrl?.length<500000));
    for(const product of durable.profile.products){if(!product.mediaGallery)continue;product.mediaGallery.assetIds=product.mediaGallery.assetIds.filter(id=>durable.assets.some(asset=>asset.assetId===id));if(!product.mediaGallery.assetIds.includes(product.mediaGallery.mainAssetId))product.mediaGallery.mainAssetId='';}
    try{nativeSession.setItem(prefix+'sandbox',JSON.stringify(durable));}catch(_){}
  }};
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  let queue=Promise.resolve();
  const business='/api/businesses/'+state.profile.businessId;
  root.fetch=async function(input,options={}){
    const url=new URL(typeof input==='string'?input:input.url,root.location.origin);
    const method=(options.method||input.method||'GET').toUpperCase();
    if(url.origin!==root.location.origin)return method==='GET'||url.origin===bootstrap.clerkOrigin?nativeFetch(input,options):response({error:'External writes are disabled in inspection.'},403);
    if(url.pathname==='/api/public-config' && method==='GET')return nativeFetch(input,options);
    if(!url.pathname.startsWith('/api/'))return method==='GET'?nativeFetch(input,options):response({error:'Writes are disabled outside the inspection sandbox.'},403);
    const dispatch=async()=>{
    let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):{};}catch(_){return response({error:'Invalid inspection request.'},400);}
    // Uploaded files remain in this browser. No Blob storage or database upload occurs.
    if(url.pathname.startsWith('/api/vendor-inspection-upload/') && method==='PUT'){
      const id=url.pathname.split('/').pop(),asset=state.assets.find(a=>a.assetId===id&&a.state==='pending');
      if(!asset || !(options.body instanceof Blob))return response({error:'Unknown inspection upload.'},400);
      const local=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(options.body);});localUrls.add(local);asset.deliveryUrl=local;asset.state='ready';save();return response({inspection:true});
    }
    if(url.pathname===business+'/media' && method==='POST'){
      const asset=body.asset;
      if(!asset||!['image','video'].includes(asset.kind)||!state.profile.products.some(p=>p.productId===asset.relatedEntityId))return response({error:'Choose a saved sample product.'},400);
      const id='test-upload-'+crypto.randomUUID(),created={...asset,assetId:id,businessId:state.profile.businessId,state:'pending',originalFilename:'Local inspection '+asset.kind};
      state.assets.push(created);save();return response({asset:created,uploadSession:{uploadUrl:'/api/vendor-inspection-upload/'+id,uploadToken:'inspection-only',storageKey:id}});
    }
    if(url.pathname.startsWith(business+'/media/') && method==='PATCH'){
      const asset=state.assets.find(a=>a.assetId===url.pathname.split('/').pop());
      return asset?.state==='ready'?response({asset}):response({error:'Local media upload has not completed.'},409);
    }
    if(!(url.pathname==='/api/businesses'||url.pathname===business||[business+'/products',business+'/inventory',business+'/media',business+'/orders'].includes(url.pathname)))return response({error:'This operation is disabled in inspection.'},403);
    const run=async()=>{
      const outgoing=structuredClone(state);for(const asset of outgoing.assets)if(localUrls.has(asset.deliveryUrl))asset.deliveryUrl='';
      const result=await nativeFetch('/api/businesses?resource=vendor-inspection',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:outgoing,pathname:url.pathname,method,body})});
      const data=await result.json();if(!result.ok)return response(data,result.status);
      const urls=new Map(state.assets.filter(asset=>localUrls.has(asset.deliveryUrl)).map(asset=>[asset.assetId,asset.deliveryUrl]));
      state=data.state;for(const asset of state.assets)if(urls.has(asset.assetId))asset.deliveryUrl=urls.get(asset.assetId);
      if(url.pathname===business+'/media')data.result.assets=state.assets;
      save();return response(data.result);
    };
    return run();
    };
    const pending=queue.then(dispatch,dispatch);queue=pending.then(()=>{},()=>{});return pending;
  };
  root.DEMEOSVendorInspection=Object.freeze({isLocalMediaUrl:url=>localUrls.has(url),videoSources:url=>url===bootstrap.state.assets.find(asset=>asset.assetId==='test-video')?.deliveryUrl?[{src:url.replace(/\.webm$/,'.mp4'),type:'video/mp4'},{src:url,type:'video/webm'}]:[]});
  const labels={en:'Development inspection. Sample data only. Changes stay in this browser. No live sales or payments.',es:'Inspección de desarrollo — datos de muestra. Sin aprobación, publicación, pedidos ni pagos.',fr:'Inspection de développement — données de démonstration. Aucune approbation, publication, commande ou paiement.',ar:'معاينة التطوير — بيانات تجريبية. لا موافقات أو نشر أو طلبات أو مدفوعات.',pt:'Inspeção de desenvolvimento — dados de exemplo. Sem aprovação, publicação, pedidos ou pagamentos.',zh:'开发预览 — 测试数据。无业务批准、发布、订单或付款。',hi:'विकास निरीक्षण — नमूना डेटा। कोई स्वीकृति, प्रकाशन, ऑर्डर या भुगतान नहीं।',de:'Entwicklungsansicht — Beispieldaten. Keine Freigabe, Veröffentlichung, Bestellungen oder Zahlungen.',ja:'開発プレビュー — サンプルデータ。承認、公開、注文、支払いはありません。'};
  function mark(){document.body.dataset.vendorInspection='true';const code=root.localStorage.getItem('demeos-customer-language')||'en';let banner=document.getElementById('vendor-inspection-notice');if(!banner){banner=document.createElement('aside');banner.id='vendor-inspection-notice';banner.setAttribute('role','note');banner.style.cssText='position:sticky;top:0;z-index:1000;background:#102844;color:#fff;padding:12px 18px;border-bottom:3px solid #c6a75e;font:14px/1.5 system-ui';document.body.prepend(banner);}banner.textContent=labels[code]||labels.en;banner.lang=code;banner.dir=code==='ar'?'rtl':'ltr';
    document.querySelectorAll('[href="/selling-vendor"],[href^="/selling-vendor/manage"]').forEach(link=>{link.href=link.getAttribute('href').replace('/selling-vendor','/selling-vendor/inspect');});
    const saveBusiness=document.getElementById('save-business-profile-btn'),submit=document.getElementById('submit-business-btn');if(saveBusiness)saveBusiness.disabled=true;if(submit)submit.disabled=true;
  }
  document.addEventListener('DOMContentLoaded',mark);document.addEventListener('owner-model-ready',mark);document.addEventListener('change',event=>{if(event.target.id==='owner-preparation-language')mark();});
})(window);
