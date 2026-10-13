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
  let queue=Promise.resolve(),active=true,epoch=0,issue='',checking=false,recoveryTimer=null,recoveryAttempts=0;
  const cachedReads=new Map();
  const checkFlag=Symbol('inspection-revalidation');
  function boundedInspectionRequest(operation){
    if(typeof root.setTimeout!=='function')return operation;
    let timer;const timeout=new Promise((_resolve,reject)=>{timer=root.setTimeout(()=>reject(new Error('Inspection request timed out')),15000);});
    return Promise.race([operation,timeout]).finally(()=>root.clearTimeout(timer));
  }

  const ownsRecord=(record,id)=>active&&id===state.profile.businessId&&record?.inspection===true&&record.businessProfile?.businessId===id&&record.workspaceReadiness?.businessId===id&&record.workspaceReadiness?.onboarding?.approved===false;
  function authView(){if(!document.getElementById)return;const elements=root.getOwnerAuthenticationElements?.(document);if(elements&&root.showOwnerAuthenticationState)root.showOwnerAuthenticationState(elements,'signed-out');}
  function cancelRecovery(){if(recoveryTimer!==null&&root.clearTimeout)root.clearTimeout(recoveryTimer);recoveryTimer=null;}
  function scheduleRecovery(){
    if(!active||issue!=='unavailable'||recoveryTimer!==null||recoveryAttempts>=3||typeof root.setTimeout!=='function')return;
    recoveryTimer=root.setTimeout(()=>{recoveryTimer=null;if(!active||issue!=='unavailable')return;if(document.hidden||root.navigator?.onLine===false)return;recoveryAttempts++;revalidate();},2000*2**recoveryAttempts);
  }
  function pause(reason,retryable=false){if(issue!==reason)epoch++;issue=reason;const workspace=document.getElementById?.('owner-authenticated-workspace');if(workspace)workspace.inert=reason==='expired'||reason==='account';if(reason==='expired'||reason==='account'){cancelRecovery();cachedReads.clear();authView();}if(retryable)scheduleRecovery();if(document.createElement)mark();}
  function resume(){cancelRecovery();recoveryAttempts=0;issue='';const workspace=document.getElementById?.('owner-authenticated-workspace');if(workspace)workspace.inert=false;if(document.createElement)mark();const elements=root.getOwnerAuthenticationElements?.(document);if(elements)root.showOwnerAuthenticationState?.(elements,'signed-in');}
  async function revalidate(){if(!active||checking)return;checking=true;try{const result=await root.fetch(business,{credentials:'same-origin',cache:'no-store',[checkFlag]:true});if(result.ok){const record=await result.json();if(ownsRecord(record,state.profile.businessId))resume();else pause('unavailable');}}catch(_){pause('unavailable',true);}finally{checking=false;}}
  function sessionChanged(auth,session){const id=auth?.user?.id;if(id&&id!==bootstrap.identityId){pause('account');return;}if(!id&&!session){pause('expired');return;}if(id===bootstrap.identityId&&issue)revalidate();}
  function exit(){if(!active)return;active=false;cancelRecovery();cachedReads.clear();epoch++;save();const workspace=document.getElementById?.('owner-authenticated-workspace');if(workspace)workspace.inert=true;root.location.assign('/selling-vendor');}

  const business='/api/businesses/'+state.profile.businessId;
  root.fetch=async function(input,options={}){
    const url=new URL(typeof input==='string'?input:input.url,root.location.origin);
    const method=(options.method||input.method||'GET').toUpperCase();
    if(url.origin!==root.location.origin)return method==='GET'||url.origin===bootstrap.clerkOrigin?nativeFetch(input,options):response({error:'External writes are disabled in inspection.'},403);
    if(url.pathname==='/api/public-config' && method==='GET')return nativeFetch(input,options);
    if(!url.pathname.startsWith('/api/'))return method==='GET'?nativeFetch(input,options):response({error:'Writes are disabled outside the inspection sandbox.'},403);
    const dispatch=async()=>{
    const generation=epoch;
    let requestStage='inspection-state';
    if(!active)return response({error:'Inspection was deliberately exited.'},409);
    if(issue && !options[checkFlag]){
      // Retained sample reads are never real business authority or another account's records.
      if(issue==='unavailable'&&method==='GET'&&root.Clerk?.user?.id===bootstrap.identityId&&root.Clerk?.session&&cachedReads.has(url.pathname))return response(structuredClone(cachedReads.get(url.pathname)));
      return response({error:issue==='expired'?'Sign in to resume Development inspection.':'Inspection is temporarily unavailable.'},issue==='expired'?401:issue==='unavailable'?503:409);
    }

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
      requestStage='session-token';
      const session=root.Clerk?.session;
      const token=session?.getToken?await boundedInspectionRequest(Promise.resolve().then(()=>session.getToken())):null;
      if(root.Clerk?.user && root.Clerk.user.id!==bootstrap.identityId){pause('account');return response({error:'Inspection account changed.'},403);}
      if(!active || generation!==epoch)return response({error:'Inspection session changed. Retry.'},409);
      if(session?.getToken && !token){pause('expired');return response({error:'Sign in to resume Development inspection.'},401);}
      const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
      requestStage='inspection-request';
      const result=await boundedInspectionRequest(nativeFetch('/api/businesses?resource=vendor-inspection' ,{method:'POST',credentials:'same-origin',headers,body:JSON.stringify({identityId:bootstrap.identityId,state:outgoing,pathname:url.pathname,method,body})}));
      requestStage='inspection-response';
      const data=await boundedInspectionRequest(result.json());
      if(!active || generation!==epoch)return response({error:'Inspection session changed. Retry.'},409);
      if(!result.ok){root.console?.warn('DEMEOS inspection request rejected during '+requestStage+' (HTTP '+result.status+')');if(result.status===401)pause('expired');else if(data.reason==='inspection-account-changed')pause('account');else if(method==='GET')pause('unavailable',result.status>=500||result.status===429);return response(data,result.status);}
      const urls=new Map(state.assets.filter(asset=>localUrls.has(asset.deliveryUrl)).map(asset=>[asset.assetId,asset.deliveryUrl]));
      if(data.state?.profile?.businessId!==bootstrap.state.profile.businessId||data.state.profile.applicationAccess||data.state.profile.applicationDecisions){pause('unavailable');return response({error:'Invalid inspection response.'},409);}
      state=data.state;for(const asset of state.assets)if(urls.has(asset.assetId))asset.deliveryUrl=urls.get(asset.assetId);
      if(url.pathname===business+'/media')data.result.assets=state.assets;
      if(method==='GET')cachedReads.set(url.pathname,structuredClone(data.result));else cachedReads.clear();
      save();return response(data.result);
    };
    return run().catch(()=>{
      if(!active||generation!==epoch)return response({error:'Inspection session changed. Retry.'},409);
      // Diagnose provider/transport failures without logging credentials, records or URLs.
      root.console?.warn('DEMEOS inspection refresh failed during '+requestStage);
      pause('unavailable',true);return response({error:'Inspection could not be refreshed. Retry inspection.'},503);
    });
    };
    const pending=queue.then(dispatch,dispatch);queue=pending.then(()=>{},()=>{});return pending;
  };
  root.DEMEOSVendorInspection=Object.freeze({ownsRecord,revalidate,sessionChanged,exit,authenticationRequired:()=>issue==='expired'||issue==='account',isPaused:()=>Boolean(issue),isLocalMediaUrl:url=>localUrls.has(url),videoSources:url=>url===bootstrap.state.assets.find(asset=>asset.assetId==='test-video')?.deliveryUrl?[{src:url.replace(/\.webm$/,'.mp4'),type:'video/mp4'},{src:url,type:'video/webm'}]:[]});
  const labels={en:'Development inspection. Sample data only. Changes stay in this browser. No live sales or payments.',es:'Inspección de desarrollo — datos de muestra. Sin aprobación, publicación, pedidos ni pagos.',fr:'Inspection de développement — données de démonstration. Aucune approbation, publication, commande ou paiement.',ar:'معاينة التطوير — بيانات تجريبية. لا موافقات أو نشر أو طلبات أو مدفوعات.',pt:'Inspeção de desenvolvimento — dados de exemplo. Sem aprovação, publicação, pedidos ou pagamentos.',zh:'开发预览 — 测试数据。无业务批准、发布、订单或付款。',hi:'विकास निरीक्षण — नमूना डेटा। कोई स्वीकृति, प्रकाशन, ऑर्डर या भुगतान नहीं।',de:'Entwicklungsansicht — Beispieldaten. Keine Freigabe, Veröffentlichung, Bestellungen oder Zahlungen.',ja:'開発プレビュー — サンプルデータ。承認、公開、注文、支払いはありません。'};
  const notices={
    en:['Your inspection session expired. Sign in to resume.','The signed-in account changed. Reopen inspection with that account.','Inspection could not be refreshed. Your sample changes are retained.','Reopen inspection','Retry inspection'],
    es:['Tu sesión de inspección caducó. Inicia sesión para continuar.','La cuenta ha cambiado. Abre la inspección con esa cuenta.','No se pudo actualizar la inspección. Tus cambios de muestra se conservan.','Reabrir inspección','Reintentar inspección'],
    fr:['Votre session a expiré. Connectez-vous pour continuer.','Le compte connecté a changé. Rouvrez l’inspection avec ce compte.','Actualisation impossible. Vos modifications de démonstration sont conservées.','Rouvrir l’inspection','Réessayer'],
    ar:['انتهت جلسة المعاينة. سجّل الدخول للمتابعة.','تغير الحساب المسجل. أعد فتح المعاينة بهذا الحساب.','تعذر تحديث المعاينة. تم الاحتفاظ بالتغييرات التجريبية.','إعادة فتح المعاينة','إعادة المحاولة'],
    pt:['A sessão expirou. Entre para continuar.','A conta mudou. Reabra a inspeção com essa conta.','Não foi possível atualizar. As alterações de exemplo foram mantidas.','Reabrir inspeção','Tentar novamente'],
    zh:['预览会话已过期。请登录以继续。','登录账户已更改。请使用该账户重新打开预览。','无法刷新预览。您的测试修改已保留。','重新打开预览','重试预览'],
    hi:['निरीक्षण सत्र समाप्त हो गया। जारी रखने के लिए साइन इन करें।','साइन इन किया गया खाता बदल गया। उस खाते से निरीक्षण फिर खोलें।','निरीक्षण रीफ़्रेश नहीं हुआ। नमूना बदलाव सुरक्षित हैं।','निरीक्षण फिर खोलें','फिर प्रयास करें'],
    de:['Die Sitzung ist abgelaufen. Melden Sie sich erneut an.','Das Konto wurde gewechselt. Öffnen Sie die Ansicht mit diesem Konto erneut.','Aktualisierung nicht möglich. Ihre Beispieländerungen bleiben erhalten.','Ansicht erneut öffnen','Erneut versuchen'],
    ja:['セッションが期限切れです。サインインして再開してください。','アカウントが変更されました。そのアカウントでプレビューを開き直してください。','更新できませんでした。サンプルの変更は保存されています。','プレビューを開き直す','再試行']
  };
  function mark(){document.body.dataset.vendorInspection='true';const code=root.localStorage.getItem('demeos-customer-language')||'en';let banner=document.getElementById('vendor-inspection-notice');if(!banner){banner=document.createElement('aside');banner.id='vendor-inspection-notice';banner.setAttribute('role','note');banner.className='vendor-inspection-notice';document.body.prepend(banner);}banner.replaceChildren();const summary=document.createElement('span');summary.className='vendor-inspection-summary';summary.textContent=labels[code]||labels.en;banner.append(summary);const notice=notices[code]||notices.en;if(issue){const warning=document.createElement('span');warning.className='vendor-inspection-warning';warning.textContent=notice[issue==='expired'?0:issue==='account'?1:2];summary.append(' ',warning);}const controls=document.createElement('span');controls.className='vendor-inspection-actions';banner.append(controls);const exitLabel={en:'Exit inspection',es:'Salir de la inspección',fr:'Quitter l’inspection',ar:'إنهاء المعاينة',pt:'Sair da inspeção',zh:'退出预览',hi:'निरीक्षण से बाहर निकलें',de:'Inspektion verlassen',ja:'プレビューを終了'};const exitButton=document.createElement('button');exitButton.type='button';exitButton.id='vendor-inspection-exit';exitButton.textContent=exitLabel[code]||exitLabel.en;exitButton.addEventListener('click',exit);controls.append(exitButton);if(issue){const retry=document.createElement('button');retry.type='button';retry.id='vendor-inspection-retry';retry.textContent=notice[issue==='account'?3:4];retry.addEventListener('click',()=>issue==='account'?root.location.reload():revalidate());controls.append(retry);}banner.lang=code;banner.dir=code==='ar'?'rtl':'ltr';
    document.querySelectorAll('[href="/selling-vendor"],[href^="/selling-vendor/manage"]').forEach(link=>{link.href=link.getAttribute('href').replace('/selling-vendor','/selling-vendor/inspect');});
    const saveBusiness=document.getElementById('save-business-profile-btn'),submit=document.getElementById('submit-business-btn');if(saveBusiness)saveBusiness.disabled=true;if(submit)submit.disabled=true;
  }
  root.addEventListener?.('online',()=>{if(issue==='unavailable'){recoveryAttempts=0;cancelRecovery();revalidate();}});
  document.addEventListener('DOMContentLoaded',mark);document.addEventListener('owner-model-ready',mark);document.addEventListener('change',event=>{if(event.target.id==='owner-preparation-language')mark();});
})(window);
