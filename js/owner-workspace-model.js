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
  function destination(model, view) {
    const base = model === 'selling' ? '/selling-vendor' : '/marketing-business';
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
      return {status: denied ? 'denied' : ['submitted', 'changes-requested', 'reviewed'].includes(ready.onboarding?.status) ? 'pending' : 'unavailable', model: null, allowed};
    }
    if (preference && !allowed.includes(preference)) return {status:'denied', model:null, allowed, businessId};
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
    forbidden: ['Business access unavailable', 'This account cannot access the selected business.'],
    unavailable: ['Workspace could not be loaded', 'Try again. Your saved information has not changed.']
  };
  function getState(doc) { return states.get(doc)?.state || {status: 'loading', model: null, allowed: []}; }
  function apply(doc, record, businessId, failure, requestedModel) {
    const previous = states.get(doc);
    const activeRoute = routeApplication();
    if (activeRoute) {
      doc.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href === 'business-workspace.html') link.href = destination(activeRoute, 'dashboard');
        else if (href === 'business-results.html') link.href = destination(activeRoute, 'results');
        else if (href.startsWith('marketing.html')) link.href = destination(activeRoute, href.split('#')[1] || 'overview');
      });
    }
    let preference = previous?.businessId === businessId ? previous.state.model : null;
    try { if (!preference) preference = root.sessionStorage?.getItem('demeosOwnerView:' + businessId); } catch (_) {}
    const application = routeApplication();
    const state = resolve(record, businessId, application || requestedModel || (['marketing','selling'].includes(preference) ? preference : null), failure);
    if (!application && state.status === 'ready') {
      const path = root.location?.pathname || '';
      if (path.endsWith('/marketing.html') || path.endsWith('/business-results.html') || state.allowed.length === 1) {
        const selected = path.endsWith('/business-results.html') ? 'marketing' : state.model;
        if (state.allowed.includes(selected)) root.location?.replace(destination(selected, path.endsWith('/business-workspace.html') ? 'dashboard' : path.endsWith('/business-results.html') ? 'results' : root.location?.hash?.slice(1) || (selected === 'selling' ? 'products' : 'overview')));
        else root.location?.replace(destination(state.model, 'dashboard'));
      }
    }
    states.set(doc, {state, record, businessId});
    doc.body.dataset.ownerModel = state.model || 'none';
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
      else if (state.status === 'denied') title.textContent = copy('applicationPending', title.textContent);
      container.appendChild(title);
      const status = doc.createElement('span');
      status.textContent = state.model === 'marketing' ? 'Private marketing preparation' : state.model === 'selling' ? 'Preparation only. Selling is not enabled.' : messages[state.status][1];
      if(state.model) status.textContent = copy(state.model === 'selling' ? 'applicationSellingPrivate' : 'applicationMarketingPrivate', status.textContent);
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
    const select = doc.getElementById('owner-preparation-language');
    if (select && !select.dataset.applicationBound) { select.dataset.applicationBound='true';select.addEventListener('change',()=>{const current=states.get(doc);if(current)apply(doc,current.record,current.businessId);}); }
    const businessCaption=doc.querySelector('.cuisine-type');if(businessCaption)businessCaption.textContent=state.status==='ready'?record.businessProfile.name:'';
    const guide = doc.querySelector('.owner-preparation-guide');
    if (guide) { guide.hidden = false; const text=guide.querySelector('[data-owner-copy=guide]'); if(text)text.hidden=state.model !== 'marketing'; }
    const secondary = doc.querySelector('.marketing-secondary-sidebar');
    if (secondary) secondary.hidden = state.model !== 'marketing' || !marketingViews.has(root.location?.hash?.slice(1) || 'overview');
    const subtitle=doc.querySelector('.marketing-capability-heading>p');if(subtitle)subtitle.hidden=state.model!=='marketing';
    const productsTitle = doc.getElementById('products-heading');
    if (productsTitle) productsTitle.textContent = state.model === 'selling' ? (root.location?.hash === '#product-options' ? 'Options and Availability' : 'Product Catalogue') : 'Products and Services';
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
  else root.DEMEOSOwnerWorkspace = api;
})(typeof window !== 'undefined' ? window : globalThis);
