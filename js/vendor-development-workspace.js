(function(root){
  'use strict';
  const bootstrap=root.DEMEOS_VENDOR_INSPECTION;
  if(!bootstrap || !/^\/selling-vendor(?:\/manage)?$/.test(root.location.pathname))return;
  const nativeFetch=root.fetch.bind(root),nativeLocal=root.localStorage,nativeSession=root.sessionStorage;
  const prefix='demeos:vendor-development:'+bootstrap.identityId+':';
  const localUrls=new Set();
  const cloudUploads=new Map();
  const storage=original=>{
    const target=key=>String(key).startsWith('demeos')&&key!=='demeos-customer-language'?[nativeSession,prefix+key]:[original,key];
    return {getItem(key){const [store,id]=target(key);return store.getItem(id);},setItem(key,value){const [store,id]=target(key);store.setItem(id,String(value));},removeItem(key){const [store,id]=target(key);store.removeItem(id);},clear(){for(let i=nativeSession.length-1;i>=0;i--){const key=nativeSession.key(i);if(key?.startsWith(prefix))nativeSession.removeItem(key);}},key:i=>original.key(i),get length(){return original.length;}};
  };
  Object.defineProperty(root,'localStorage',{value:storage(nativeLocal)});
  Object.defineProperty(root,'sessionStorage',{value:storage(nativeSession)});
  let state=bootstrap.state;
  try{const saved=JSON.parse(nativeSession.getItem(prefix+'sandbox')||'null');if(saved?.profile?.businessId===state.profile.businessId&&!saved.profile.applicationAccess)state=saved;}catch(_){}
  for(const asset of state.assets){const current=bootstrap.state.assets.find(item=>item.assetId===asset.assetId);if(current){asset.deliveryUrl=current.deliveryUrl;asset.originalFilename=current.originalFilename;}}
  for(const asset of state.assets)if(/^data:(?:image|video)\//.test(asset.deliveryUrl||''))localUrls.add(asset.deliveryUrl);
  const save=()=>{try{nativeSession.setItem(prefix+'sandbox',JSON.stringify(state));}catch(_){const durable=structuredClone(state);durable.assets=durable.assets.filter(asset=>!asset.assetId.startsWith('test-upload-')||(asset.state==='ready'&&asset.deliveryUrl?.length<500000));for(const product of durable.profile.products){if(!product.mediaGallery)continue;product.mediaGallery.assetIds=product.mediaGallery.assetIds.filter(id=>durable.assets.some(asset=>asset.assetId===id));if(!product.mediaGallery.assetIds.includes(product.mediaGallery.mainAssetId))product.mediaGallery.mainAssetId='';}try{nativeSession.setItem(prefix+'sandbox',JSON.stringify(durable));}catch(_){}}};
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  let queue=Promise.resolve(),active=true,epoch=0,issue='',checking=false,recoveryTimer=null,recoveryAttempts=0;
  const cachedReads=new Map();
  const checkFlag=Symbol('development-revalidation');
  function boundedRequest(operation,timeoutMs=15000){if(typeof root.setTimeout!=='function')return operation;let timer;const timeout=new Promise((_resolve,reject)=>{timer=root.setTimeout(()=>{const error=new Error('Development request timed out');error.code='development-request-timeout';reject(error);},timeoutMs);});return Promise.race([operation,timeout]).finally(()=>root.clearTimeout(timer));}
  const ownsRecord=(record,id)=>active&&id===state.profile.businessId&&record?.inspection===true&&record.businessProfile?.businessId===id&&record.workspaceReadiness?.businessId===id&&record.workspaceReadiness?.onboarding?.approved===false;
  function authView(){if(!document.getElementById)return;const elements=root.getOwnerAuthenticationElements?.(document);if(elements&&root.showOwnerAuthenticationState)root.showOwnerAuthenticationState(elements,'signed-out');}
  function cancelRecovery(){if(recoveryTimer!==null&&root.clearTimeout)root.clearTimeout(recoveryTimer);recoveryTimer=null;}
  function scheduleRecovery(){if(!active||issue!=='unavailable'||recoveryTimer!==null||recoveryAttempts>=3||typeof root.setTimeout!=='function')return;recoveryTimer=root.setTimeout(()=>{recoveryTimer=null;if(!active||issue!=='unavailable')return;if(document.hidden||root.navigator?.onLine===false)return;recoveryAttempts++;revalidate();},2000*2**recoveryAttempts);}
  function pause(reason,retryable=false){if(issue!==reason)epoch++;issue=reason;const workspace=document.getElementById?.('owner-authenticated-workspace');if(workspace)workspace.inert=reason==='expired'||reason==='account';if(reason==='expired'||reason==='account'){cancelRecovery();cachedReads.clear();cloudUploads.clear();authView();}if(retryable)scheduleRecovery();}
  function resume(){cancelRecovery();recoveryAttempts=0;issue='';const workspace=document.getElementById?.('owner-authenticated-workspace');if(workspace)workspace.inert=false;const elements=root.getOwnerAuthenticationElements?.(document);if(elements)root.showOwnerAuthenticationState?.(elements,'signed-in');}
  async function revalidate(){if(!active||checking)return;checking=true;try{const result=await root.fetch(business,{credentials:'same-origin',cache:'no-store',[checkFlag]:true});if(result.ok){const record=await result.json();if(ownsRecord(record,state.profile.businessId))resume();else pause('unavailable');}}catch(_){pause('unavailable',true);}finally{checking=false;}}
  function sessionChanged(auth,session){const id=auth?.user?.id;if(id&&id!==bootstrap.identityId){pause('account');return;}if(!id&&!session){pause('expired');return;}if(id===bootstrap.identityId&&issue)revalidate();}
  const business='/api/businesses/'+state.profile.businessId;
  root.fetch=async function(input,options={}){
    const url=new URL(typeof input?.url==='string'?input.url:String(input),root.location.origin);
    const method=(options.method||input?.method||'GET').toUpperCase();
    const cloudUpload=cloudUploads.get(url.href);
    if(cloudUpload&&method==='PUT'){
      if(!active||issue||root.Clerk?.user?.id!==bootstrap.identityId||!root.Clerk?.session||Date.parse(cloudUpload.expiresAt)<=Date.now()||!(options.body instanceof Blob)||options.body.type!==cloudUpload.contentType||options.body.size!==cloudUpload.sizeBytes)return response({error:'This private development upload is no longer available.'},403);
      return nativeFetch(input,options);
    }
    if(url.origin!==root.location.origin)return method==='GET'||url.origin===bootstrap.clerkOrigin?nativeFetch(input,options):response({error:'External writes are disabled in the development workspace.'},403);
    if(url.pathname==='/api/public-config' && method==='GET')return nativeFetch(input,options);
    if(!url.pathname.startsWith('/api/'))return method==='GET'?nativeFetch(input,options):response({error:'Writes are disabled outside the development workspace.'},403);
    const dispatch=async()=>{
      const generation=epoch;let requestStage='development-state';
      if(!active)return response({error:'Development workspace is unavailable.'},409);
      if(issue && !options[checkFlag]){if(issue==='unavailable'&&method==='GET'&&root.Clerk?.user?.id===bootstrap.identityId&&root.Clerk?.session&&cachedReads.has(url.pathname))return response(structuredClone(cachedReads.get(url.pathname)));return response({error:issue==='expired'?'Sign in to resume development.':'Development workspace is temporarily unavailable.'},issue==='expired'?401:issue==='unavailable'?503:409);}
      let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):{};}catch(_){return response({error:'Invalid development request.'},400);}
      if(url.pathname.startsWith('/api/vendor-inspection-upload/') && method==='PUT'){
        const id=url.pathname.split('/').pop(),asset=state.assets.find(a=>a.assetId===id&&a.state==='pending');
        if(!asset || !(options.body instanceof Blob))return response({error:'Unknown development upload.'},400);
        const local=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(options.body);});localUrls.add(local);asset.deliveryUrl=local;asset.state='ready';save();return response({inspection:true});
      }
      if(!bootstrap.cloudMedia && url.pathname===business+'/media' && method==='POST'){
        const asset=body.asset;if(!asset||!['image','video'].includes(asset.kind)||!state.profile.products.some(p=>p.productId===asset.relatedEntityId))return response({error:'Choose a saved development product.'},400);
        const id='test-upload-'+crypto.randomUUID(),created={...asset,assetId:id,businessId:state.profile.businessId,state:'pending',originalFilename:'Development '+asset.kind};state.assets.push(created);save();return response({asset:created,uploadSession:{uploadUrl:'/api/vendor-inspection-upload/'+id,uploadToken:'development-only',storageKey:id}});
      }
      if((!bootstrap.cloudMedia||url.pathname.startsWith(business+'/media/test-upload-')) && url.pathname.startsWith(business+'/media/') && method==='PATCH'){const asset=state.assets.find(a=>a.assetId===url.pathname.split('/').pop());return asset?.state==='ready'?response({asset}):response({error:'Local media upload has not completed.'},409);}
      if(!(url.pathname==='/api/businesses'||url.pathname===business||[business+'/products',business+'/inventory',business+'/media',business+'/orders'].includes(url.pathname)||(bootstrap.cloudMedia&&method==='PATCH'&&url.pathname.startsWith(business+'/media/test-cloud-'))))return response({error:'This operation is disabled in the development workspace.'},403);
      const run=async()=>{
        const outgoing=structuredClone(state);for(const asset of outgoing.assets)if(localUrls.has(asset.deliveryUrl))asset.deliveryUrl='';
        requestStage='session-token';const session=root.Clerk?.session;let token=null,verifyCookie=false;
        if(session?.getToken){try{token=await boundedRequest(Promise.resolve().then(()=>session.getToken()));}catch(error){if(error?.code==='development-request-timeout')throw error;verifyCookie=true;root.console?.warn('DEMEOS development token refresh unavailable; checking server session cookie');}}
        if(root.Clerk?.user && root.Clerk.user.id!==bootstrap.identityId){pause('account');return response({error:'Development account changed.'},403);}
        if(!active || generation!==epoch)return response({error:'Development session changed. Retry.'},409);
        if(session?.getToken && !token && !verifyCookie){pause('expired');return response({error:'Sign in to resume development.'},401);}
        const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
        requestStage='development-request';const completion=bootstrap.cloudMedia&&method==='PATCH'&&body.action==='complete-upload';
        const result=await boundedRequest(nativeFetch('/api/businesses?resource=vendor-inspection',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify({identityId:bootstrap.identityId,state:outgoing,pathname:url.pathname,method,body})}),completion?45000:15000);
        requestStage='development-response';const data=await boundedRequest(result.json());
        if(!active || generation!==epoch)return response({error:'Development session changed. Retry.'},409);
        if(!result.ok){root.console?.warn('DEMEOS development request rejected during '+requestStage+' (HTTP '+result.status+')');if(result.status===401)pause('expired');else if(data.reason==='inspection-account-changed')pause('account');else if(method==='GET')pause('unavailable',result.status>=500||result.status===429);return response(data,result.status);}
        const urls=new Map(state.assets.filter(asset=>localUrls.has(asset.deliveryUrl)).map(asset=>[asset.assetId,asset.deliveryUrl]));
        if(data.state?.profile?.businessId!==bootstrap.state.profile.businessId||data.state.profile.applicationAccess||data.state.profile.applicationDecisions){pause('unavailable');return response({error:'Invalid development response.'},409);}
        state=data.state;for(const asset of state.assets)if(urls.has(asset.assetId))asset.deliveryUrl=urls.get(asset.assetId);
        if(url.pathname===business+'/media'&&method==='GET')data.result.assets=state.assets;
        if(bootstrap.cloudMedia&&method==='POST'&&url.pathname===business+'/media'&&data.result?.uploadSession?.uploadUrl){const asset=data.result.asset,upload=data.result.uploadSession;cloudUploads.set(new URL(upload.uploadUrl).href,{assetId:asset.assetId,contentType:asset.contentType,sizeBytes:asset.sizeBytes,expiresAt:upload.expiresAt});}
        if(bootstrap.cloudMedia&&method==='PATCH'&&data.result?.asset?.state==='ready')for(const [uploadUrl,entry] of cloudUploads)if(entry.assetId===data.result.asset.assetId)cloudUploads.delete(uploadUrl);
        if(method==='GET')cachedReads.set(url.pathname,structuredClone(data.result));else cachedReads.clear();save();return response(data.result);
      };
      return run().catch(()=>{if(!active||generation!==epoch)return response({error:'Development session changed. Retry.'},409);root.console?.warn('DEMEOS development refresh failed during '+requestStage);pause('unavailable',true);return response({error:'Development workspace could not be refreshed. Retry.'},503);});
    };
    const pending=queue.then(dispatch,dispatch);queue=pending.then(()=>{},()=>{});return pending;
  };
  root.DEMEOSVendorInspection=Object.freeze({ownsRecord,revalidate,sessionChanged,authenticationRequired:()=>issue==='expired'||issue==='account',isPaused:()=>Boolean(issue),isLocalMediaUrl:url=>localUrls.has(url),videoSources:url=>url===bootstrap.state.assets.find(asset=>asset.assetId==='test-video')?.deliveryUrl?[{src:url.replace(/\.webm$/,'.mp4'),type:'video/mp4'},{src:url,type:'video/webm'}]:[]});
  document.body.dataset.vendorDevelopment='true';
  root.addEventListener?.('online',()=>{if(issue==='unavailable'){recoveryAttempts=0;cancelRecovery();revalidate();}});
})(window);