(function (root) {
  'use strict';
  const states = new WeakMap();
  function language() { try { return root.localStorage?.getItem('demeos-customer-language') || 'en'; } catch (_) {return 'en';} }
  function copy(key, fallback) { return root.DEMEOSVendorCopy?.[language()]?.[key] || root.DEMEOSVendorCopy?.en?.[key] || fallback; }
  const navigationKeys = {overview:'applicationOverview','business-profile':'applicationBusiness',products:'applicationOffers',media:'applicationMedia','product-options':'applicationOptions',marketing:'applicationMarketing',results:'applicationResults',inventory:'applicationStock',orders:'applicationOrders'};

  const marketingViews = new Set(['overview', 'recommends', 'create', 'campaigns', 'results-view']);
  function routeApplication() {
    const path = root.location?.pathname || '';
    return path.startsWith('/marketing-business') ? 'marketing' : path.startsWith('/selling-vendor') ? 'selling' : null;
  }
  function identifyApplication(doc) {
    const application = routeApplication(); if (!application) return;
    const name = copy(application === 'selling' ? 'sellingApplication' : 'marketingApplication', application === 'selling' ? 'Selling Vendor Application' : 'Marketing Business Application');
    const header = doc.querySelector('.restaurant-name'); if (header) header.textContent = name;
    doc.title = name + ' | DEMEOS';
    const signedOut = doc.getElementById('owner-auth-signed-out');
    const heading = signedOut?.querySelector('h2'), detail = signedOut?.querySelector('h2+p');
    if (heading) heading.textContent = copy('applicationSignIn', 'Sign in to continue');
    if (detail) detail.textContent = copy('applicationSignInDetail', 'Use your DEMEOS account to access this application.');
  }
  function destination(model, view) {
    const base = model === 'selling' ? ((root.DEMEOSVendorInspection || root.DEMEOSVendorInspectionEntry) ? '/selling-vendor/inspect' : '/selling-vendor') : '/marketing-business';
    return view === 'dashboard' ? base : view === 'results' ? base + '/results' : base + '/manage#' + view;
  }
  function resolve(record, businessId, preference, failure) {
    if (failure) return {status: failure, model: null, allowed: []};
    if (!businessId) return {status: 'setup', model: null, allowed: []};
    if (!record || record.businessProfile?.businessId !== businessId || record.workspaceReadiness?.businessId !== businessId)
      return {status: 'unavailable', model: null, allowed: []};
    const ready = record.workspaceReadiness;
    const allowed = ['marketing', 'selling'].filter(model => ready[model]?.canPrepare === true);
    if (!allowed.length) {
      const denied = ['marketing', 'selling'].every(model => ready[model]?.canPrepare === false);
      const lifecycle=(preference&&ready.onboarding?.applicationStatuses?.[preference]?.status)||ready.onboarding?.status;
      return {status: ['rejected','revoked'].includes(lifecycle) ? lifecycle : denied ? 'denied' : ['submitted', 'changes-requested', 'reviewed'].includes(ready.onboarding?.status) ? 'pending' : 'unavailable', model: null, allowed};
    }
    if (preference && !allowed.includes(preference)) return {status:['rejected','revoked'].includes(ready.onboarding?.applicationStatuses?.[preference]?.status)?ready.onboarding.applicationStatuses[preference].status:'denied', model:null, allowed, businessId};
    const intent = null;
    const model = allowed.includes(preference) ? preference : allowed.includes(intent) ? intent : allowed[0];
    return {status: 'ready', model, allowed, businessId};
  }
  function canOpen(state, view) {
    if (view === 'business-profile') return true;
    if (state?.status !== 'ready') return false;
    if (view === 'products' || view === 'media' || view === 'product-options') return true;
    if (view === 'inventory' || view === 'orders') return state.model === 'selling';
    return state.model === 'marketing' && marketingViews.has(view);
  }
  const messages = {
    loading: ['Checking your workspace', 'Please wait.'],
    setup: ['Set up your business', 'Save your business details to continue.'],
    pending: ['Preparation access pending', 'Your submission is private. Check My Business for its review status.'],
    denied: ['Application access pending', 'Your business details remain private. Application access requires DEMEOS authorisation.'],
    rejected: ['Application request rejected', 'Review your business information before resubmitting.'],
    revoked: ['Application access revoked', 'Contact DEMEOS for review.'],
    forbidden: ['Business access unavailable', 'This account cannot access the selected business.'],
    unavailable: ['Workspace could not be loaded', 'Try again. Your saved information has not changed.']
  };
  function getState(doc) { return states.get(doc)?.state || {status: 'loading', model: null, allowed: []}; }
  function apply(doc, record, businessId, failure, requestedModel) {
    identifyApplication(doc);
    const previous = states.get(doc);
    // Inspection records are a separate authority domain, never a real business grant.
    if(root.DEMEOSVendorInspection && previous?.state.status==='ready' &&
       (failure || !root.DEMEOSVendorInspection.ownsRecord(record,businessId))) return previous.state;
    const activeRoute = routeApplication();
    if (activeRoute) {
      doc.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href === 'business-workspace.html' || href === '/business-workspace.html') link.href = destination(activeRoute, 'dashboard');
        else if (href === 'business-results.html') link.href = destination(activeRoute, 'results');
        else if (href.startsWith('marketing.html')) link.href = destination(activeRoute, href.split('#')[1] || 'overview');
      });
    }
    let preference = previous?.businessId === businessId ? previous.state.model : null;
    try { if (!preference) preference = root.sessionStorage?.getItem('demeosOwnerView:' + businessId); } catch (_) {}
    const application = routeApplication();
    const remembered = record?.workspaceReadiness?.[preference]?.canPrepare === true ? preference : null;
    const state = resolve(record, businessId, application || requestedModel || remembered, failure);
    if (!application && state.status === 'ready') {
      const path = root.location?.pathname || '';
      if (path.endsWith('/marketing.html') || path.endsWith('/business-results.html') || state.allowed.length === 1) {
        const view = root.location?.hash?.slice(1);
        const legacyApplication = ['inventory','orders','product-options'].includes(view) ? 'selling' : ['overview','recommends','create','campaigns','results-view'].includes(view) || path.endsWith('/business-results.html') ? 'marketing' : state.model;
        const selected = state.allowed.includes(legacyApplication) ? legacyApplication : state.model;
        if (state.allowed.includes(selected)) root.location?.replace(destination(selected, path.endsWith('/business-workspace.html') ? 'dashboard' : path.endsWith('/business-results.html') ? (selected === 'marketing' ? 'results' : 'dashboard') : root.location?.hash?.slice(1) || (selected === 'selling' ? 'products' : 'overview')));
        else root.location?.replace(destination(state.model, 'dashboard'));
      }
    }
    states.set(doc, {state, record, businessId});
    doc.body.dataset.ownerModel = state.model || 'none';
    // The legacy Marketing visual theme must not override the Selling application theme.
    const marketingTheme=doc.querySelector('link[href="/css/demeos-business-premium.css"]');
    if(marketingTheme)marketingTheme.disabled=state.model==='selling';
    doc.body.dataset.ownerAccess = state.status;
    doc.querySelectorAll('[data-owner-marketing]').forEach(node => { node.hidden = state.model !== 'marketing'; });
    doc.querySelectorAll('[data-owner-selling]').forEach(node => { node.hidden = state.model !== 'selling'; });
    doc.body.dataset.ownerApplication = application || 'entry';
    const activity = doc.querySelector('.owner-current-work'); if (activity) activity.hidden = state.status !== 'ready';
    const container = doc.getElementById('owner-operating-models');
    if (container) {
      container.replaceChildren();
      const title = doc.createElement('strong');
      title.textContent = state.model === 'marketing' ? 'Marketing Business Application' : state.model === 'selling' ? 'Selling Vendor Application' : messages[state.status][0];
      title.className = application && state.status === 'ready' ? 'owner-visually-hidden' : '';
      if (state.model) title.textContent = copy(state.model === 'selling' ? 'sellingApplication' : 'marketingApplication', title.textContent);
      else if(['rejected','revoked'].includes(state.status))title.textContent=copy(state.status,title.textContent);
      else if (state.status === 'denied') title.textContent = copy('applicationPending', title.textContent);
      container.appendChild(title);
      const status = doc.createElement('span');
      status.textContent = state.model === 'marketing' ? 'Private marketing preparation' : state.model === 'selling' ? 'Preparation only. Selling is not enabled.' : messages[state.status][1];
      if(state.model) status.textContent = copy(state.model === 'selling' ? 'applicationSellingPrivate' : 'applicationMarketingPrivate', status.textContent);
      else if(['rejected','revoked'].includes(state.status))status.textContent=copy(state.status+'Detail',status.textContent);
      else if(state.status === 'denied') status.textContent = copy('applicationPendingDetail', status.textContent);
      container.appendChild(status);
      if (state.allowed.length > 1 || (!application && state.allowed.length)) {
        const entries = doc.createElement('div'); entries.className = 'owner-application-entries';
        entries.setAttribute('aria-label', 'Business applications');
        for (const model of state.allowed) {
          if (model === application) continue;
          const link = doc.createElement('a'); link.href = destination(model, 'dashboard');
          link.textContent = model === 'marketing' ? 'Open Marketing Business Application' : 'Open Selling Vendor Application';
          link.textContent = copy(model === 'selling' ? 'sellingApplication' : 'marketingApplication', link.textContent);
          entries.appendChild(link);
        }
        container.appendChild(entries);
      } else if (application && state.status !== 'ready') {
        const link = doc.createElement('a'); link.href = '/business-workspace.html'; link.textContent = copy('applicationReturn', 'Return to business applications'); container.appendChild(link);
      } else if (state.status === 'unavailable') {
        const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again';
        retry.addEventListener('click', () => root.location.reload()); container.appendChild(retry);
      }
    }
    const nav = doc.querySelector('.owner-workspace-navigation');
    if (nav) {
      const links = !application ? [['business-profile','My Business','marketing.html#business-profile']] : [ ['overview','Overview',destination(application,'dashboard')], ['business-profile','My Business',destination(application,'business-profile')] ];
      if (application && state.status === 'ready') {
        links.push(['products',application === 'selling' ? 'Product Catalogue' : 'Products and Services',destination(application,'products')]);
        links.push(['media',application === 'selling' ? 'Images and Videos' : 'Product and Service Media',destination(application,'media')]);
        if (application === 'marketing') links.push(['marketing','Marketing Preparation',destination(application,'overview')],['results','Marketing Results',destination(application,'results')]);
        else links.push(['product-options','Options and Variants',destination(application,'product-options')],['inventory','Stock and History',destination(application,'inventory')],['orders','Private Orders',destination(application,'orders')]);
      }
      nav.replaceChildren();
      for (const [id, label, href] of links) {
        const a = doc.createElement('a'); a.dataset.ownerSection = id;
        a.textContent = copy(id === 'products' && application === 'selling' ? 'applicationCatalogue' : navigationKeys[id], label);
        a.href = href; a.lang = language(); a.dir = language() === 'ar' ? 'rtl' : 'ltr';
        a.addEventListener('focus', () => a.scrollIntoView({block:'nearest', inline:'nearest'}));
        nav.appendChild(a);
      }
      nav.style.setProperty('--owner-nav-columns', String(links.length));
      nav.style.setProperty('--owner-nav-template', links.length === 5 ? '1fr .9fr 1.4fr 1fr .8fr' : 'repeat(' + links.length + ',minmax(0,1fr))');
      root.updateOwnerNavigation?.(doc, root.location);
    }
    const header = doc.querySelector('.restaurant-name');
    if (header) header.textContent = application === 'marketing' ? 'Marketing Business Application' : application === 'selling' ? 'Selling Vendor Application' : 'Business applications';
    if (header && application) header.textContent = copy(application === 'selling' ? 'sellingApplication' : 'marketingApplication',header.textContent);
    doc.title = header?.textContent + ' | DEMEOS';
    if(state.model==='selling'){
      const review=doc.querySelector('.owner-identity-card .owner-summary-link');if(review)review.dataset.vendorCopy='reviewBusiness';
      doc.querySelectorAll('[data-vendor-copy]').forEach(node=>{node.textContent=copy(node.dataset.vendorCopy,node.textContent);node.lang=language();node.dir=language()==='ar'?'rtl':'ltr';});
      const overview=doc.getElementById('owner-overview-heading');if(overview)overview.textContent=copy('applicationOverview','Overview');
      const next=doc.querySelector('.owner-next-action');if(next)next.hidden=true;
      const heading=doc.getElementById('current-work-heading');if(heading)heading.textContent=copy('applicationCatalogue','Product catalogue');
    }
    const select = doc.getElementById('owner-preparation-language');
    if(select)select.value=language();
    if (select && !select.dataset.applicationBound) { select.dataset.applicationBound='true';select.addEventListener('change',()=>{try{root.localStorage.setItem('demeos-customer-language',select.value);}catch(_){}const current=states.get(doc);if(current)apply(doc,current.record,current.businessId);}); }
    const businessCaption=doc.querySelector('.cuisine-type');if(businessCaption)businessCaption.textContent=state.status==='ready'?record.businessProfile.name:'';
    const guide = doc.querySelector('.owner-preparation-guide');
    if (guide) { guide.hidden = false; const text=guide.querySelector('[data-owner-copy=guide]'); if(text)text.hidden=state.model !== 'marketing'; }
    const secondary = doc.querySelector('.marketing-secondary-sidebar');
    if (secondary) secondary.hidden = state.model !== 'marketing' || !marketingViews.has(root.location?.hash?.slice(1) || 'overview');
    const subtitle=doc.querySelector('.marketing-capability-heading>p');if(subtitle)subtitle.hidden=state.model!=='marketing';
    const productsTitle = doc.getElementById('products-heading');
    if (productsTitle) productsTitle.textContent = state.model === 'selling' ? (root.location?.hash === '#product-options' ? copy('applicationOptions','Options and Availability') : copy('applicationCatalogue','Product Catalogue')) : 'Products and Services';
    // No selling results contract exists: keep marketing evidence out of that workspace.
    const resultsMain = doc.querySelector('.business-results-main');
    if (resultsMain) {
      for (const child of resultsMain.children) if (!['owner-results-unavailable', 'owner-operating-models'].includes(child.id)) child.hidden = state.model !== 'marketing';
      const notice = doc.getElementById('owner-results-unavailable'); if (notice) notice.hidden = state.model === 'marketing';
    }
    if (!previous || previous.state.model !== state.model || previous.state.status !== state.status || previous.businessId !== businessId)
      doc.dispatchEvent(new root.CustomEvent('owner-model-ready', {detail: state}));
    return state;
  }
  const api = {routeApplication, destination, resolve, canOpen, apply, getState, messages};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {root.DEMEOSOwnerWorkspace = api;identifyApplication(root.document);
    // Revalidate server authority on return to the app; never rely on browser grants.
    let checking=false;
    async function revalidate(){
      const doc=root.document,current=states.get(doc);
      if(root.DEMEOSVendorInspection){if(!doc.hidden)await root.DEMEOSVendorInspection.revalidate();return;}
      if(checking||doc.hidden||!current?.businessId||doc.getElementById('owner-authenticated-workspace')?.hidden)return;
      checking=true;try{
        const application=routeApplication();
        const response=await root.fetch('/api/businesses/'+encodeURIComponent(current.businessId)+(application?'?application='+application:''),{credentials:'same-origin',cache:'no-store'});
        if(states.get(doc)!==current)return;
        if(!response.ok){
          if([401,403].includes(response.status)){
            if(response.status===401){root.showOwnerAuthenticationState?.(root.getOwnerAuthenticationElements(doc),'signed-out');return;}
            let failure='forbidden';if(response.status===403){const denial=await response.json();if(denial.reason==='application-access-required')failure=['rejected','revoked'].includes(denial.applicationStatus)?denial.applicationStatus:'denied';}
            if(states.get(doc)!==current)return;
            root.DEMEOSBusinessOnboarding?.updateStatus({businessId:current.businessId,onboarding:{status:failure}});
            const statusNode=doc.querySelector('#workspace-business-identity [data-vendor-copy]');if(statusNode&&['rejected','revoked'].includes(failure)){statusNode.dataset.vendorCopy=failure;statusNode.textContent=copy(failure,failure);}
            apply(doc,null,current.businessId,failure);
          }
          return;
        }
        const record=await response.json();if(states.get(doc)!==current)return;
        root.DEMEOSBusinessOnboarding?.updateStatus(record.workspaceReadiness);
        const statusNode=doc.querySelector('#workspace-business-identity [data-vendor-copy]');
        const lifecycle=record.workspaceReadiness?.onboarding?.status;
        if(statusNode&&['approved','rejected','revoked'].includes(lifecycle)){statusNode.dataset.vendorCopy=lifecycle;statusNode.textContent=copy(lifecycle,lifecycle);}
        const next=resolve(record,current.businessId,routeApplication());
        if(next.status!==current.state.status||next.model!==current.state.model||JSON.stringify(next.allowed)!==JSON.stringify(current.state.allowed))apply(doc,record,current.businessId);
      }catch(_){}finally{checking=false;}
    }
    root.addEventListener('focus',revalidate);root.document.addEventListener('visibilitychange',revalidate);
    root.setInterval(revalidate,30000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
