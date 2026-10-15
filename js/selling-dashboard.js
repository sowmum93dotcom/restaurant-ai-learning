(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document){root.DEMEOSSellingDashboard=api;api.createDashboard(root).start();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const sections=Object.freeze({
    overview:['Overview','Welcome to your Selling workspace','Your identity and Selling access have been verified. Choose a section to see what comes next.'],
    'my-business':['My Business','Your saved business','These details come from your existing business record. Registration and approval continue through the existing business workflow.'],
    'product-catalogue':['Product Catalogue','Catalogue tools are being prepared','Product creation and editing are not available in this dashboard yet. Existing product records remain saved.'],
    'images-videos':['Images & Videos','Media tools are not available yet','Image and video uploads will be connected to your business and products in a later phase.'],
    'options-variants':['Options & Variants','Variant tools are not available yet','Product options and exact variants will be managed here when catalogue tools are verified.'],
    'stock-history':['Stock & History','Stock tools are not available yet','Stock adjustments and their audit history will appear here in a later phase. No stock changes can be made here yet.'],
    'private-orders':['Private Orders','Order tools are not available yet','Private orders will be shown here when the order workflow is connected and verified. This page has not loaded or changed any orders.']
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
      const section=currentSection();$('section-heading').textContent=sections[section]?.[0]||'Page not found';
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
      const section=currentSection(),copy=sections[section];
      $('content-heading').textContent=business?copy[1]:'Select your business to continue';
      $('content-message').textContent=business?copy[2]:'Use the business selector above. Your choice is kept in the page URL for refresh and direct navigation.';
      $('business-facts').hidden=section!=='my-business'||!business;
      $('business-facts').replaceChildren();
      if(section==='my-business'&&business)for(const [label,value] of [['Business ID',business.businessId],['Business name',business.name],['Business type',business.type||'Not provided'],['Location',business.location||'Not provided'],['Selling access',business.dataEnvironment==='test'?'Test access authorized':'Approved']]){
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
          if(key!==sessionKey){sessionKey=key;load();}
        });
        sessionKey=(clerk.user?.id||'')+':'+(clerk.session?.id||'');await load();
      }catch{clerk=null;status('error','Sign-in is temporarily unavailable','We could not connect to DEMEOS authentication. Please try again.');}
      finally{booting=false;}
    }
    $('retry').addEventListener('click',()=>clerk?load():start());
    $('choose-business').addEventListener('click',()=>{const url=new URL(win.location.href);url.searchParams.delete('businessId');win.history.pushState({},'',url);load();});
    $('sign-in').addEventListener('click',async()=>{try{await clerk?.openSignIn({forceRedirectUrl:'/selling-vendor',fallbackRedirectUrl:'/selling-vendor',signUpForceRedirectUrl:'/selling-vendor',signUpFallbackRedirectUrl:'/selling-vendor'});}catch{status('error','Sign-in is temporarily unavailable','Please try again.');}});
    $('sign-out').addEventListener('click',async()=>{++sequence;controller?.abort();status('loading','Signing out','Closing your private workspace…');try{await clerk.signOut();await load();}catch{status('error','Sign-out could not finish','Please retry or sign out through your account.');}});
    $('business-select').addEventListener('change',()=>{const id=$('business-select').value;if(!context?.businesses.some(b=>b.businessId===id))return;const url=new URL(win.location.href);url.searchParams.set('businessId',id);win.history.pushState({},'',url);load();});
    doc.querySelector('nav').addEventListener('click',event=>{
      const link=event.target.closest('a[data-section]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();win.history.pushState({},'',link.getAttribute('href'));load();$('main').focus();
    });
    win.addEventListener('popstate',load);
    win.addEventListener('pageshow',event=>{if(event.persisted)load();});
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){++sequence;controller?.abort();status('loading','Workspace paused','Business access will be checked when you return.');}else if(clerk)load();});
    return {start,load};
  }
  return {sections,sectionForPath,createDashboard};
});
