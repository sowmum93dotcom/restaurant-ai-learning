(function (root) {
  'use strict';
  const states = new WeakMap();
  const marketingViews = new Set(['overview', 'recommends', 'create', 'campaigns', 'results-view']);
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
    const intent = record.businessProfile.preparationModel;
    const model = allowed.includes(preference) ? preference : allowed.includes(intent) ? intent : allowed[0];
    return {status: 'ready', model, allowed, businessId};
  }
  function canOpen(state, view) {
    if (view === 'business-profile') return true;
    if (state?.status !== 'ready') return false;
    if (view === 'products' || view === 'product-options') return true;
    return state.model === 'marketing' && marketingViews.has(view);
  }
  const messages = {
    loading: ['Checking your workspace', 'Please wait.'],
    setup: ['Set up your business', 'Save your business details to continue.'],
    pending: ['Preparation access pending', 'Your submission is private. Check My Business for its review status.'],
    denied: ['Preparation is not authorised', 'Check your business details before contacting DEMEOS.'],
    forbidden: ['Business access unavailable', 'This account cannot access the selected business.'],
    unavailable: ['Workspace could not be loaded', 'Try again. Your saved information has not changed.']
  };
  function getState(doc) { return states.get(doc)?.state || {status: 'loading', model: null, allowed: []}; }
  function apply(doc, record, businessId, failure) {
    const previous = states.get(doc);
    let preference = null;
    try { preference = root.sessionStorage?.getItem('demeosOwnerView:' + businessId); } catch (_) {}
    const state = resolve(record, businessId, preference, failure);
    states.set(doc, {state, record, businessId});
    doc.body.dataset.ownerModel = state.model || 'none';
    doc.body.dataset.ownerAccess = state.status;
    doc.querySelectorAll('[data-owner-marketing]').forEach(node => { node.hidden = state.model !== 'marketing'; });
    doc.querySelectorAll('[data-owner-selling]').forEach(node => { node.hidden = state.model !== 'selling'; });
    const activity = doc.querySelector('.owner-current-work'); if (activity) activity.hidden = state.status !== 'ready';
    const container = doc.getElementById('owner-operating-models');
    if (container) {
      container.replaceChildren();
      const title = doc.createElement('strong');
      title.textContent = state.model === 'marketing' ? 'Marketing workspace' : state.model === 'selling' ? 'Selling workspace' : messages[state.status][0];
      container.appendChild(title);
      const status = doc.createElement('span');
      status.textContent = state.model === 'marketing' ? 'Private marketing preparation' : state.model === 'selling' ? 'Preparation only. Selling is not enabled.' : messages[state.status][1];
      container.appendChild(status);
      if (state.allowed.length === 2) {
        const switcher = doc.createElement('div'); switcher.className = 'owner-model-switch';
        switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', 'Business workflow');
        for (const model of state.allowed) {
          const button = doc.createElement('button'); button.type = 'button'; button.textContent = model === 'marketing' ? 'Marketing' : 'Selling';
          button.dataset.ownerModel = model; button.setAttribute('aria-pressed', String(model === state.model));
          button.addEventListener('click', () => {
            // A preference is never permission; re-resolve only against this exact server record.
            if (!state.allowed.includes(model)) return;
            try { root.sessionStorage?.setItem('demeosOwnerView:' + businessId, model); } catch (_) { return; }
            apply(doc, record, businessId);
            if (typeof root.loadOwnerNextAction === 'function') root.loadOwnerNextAction(doc, root.localStorage, root.fetch.bind(root));
          });
          switcher.appendChild(button);
        }
        container.appendChild(switcher);
      } else if (state.status === 'unavailable') {
        const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again';
        retry.addEventListener('click', () => root.location.reload()); container.appendChild(retry);
      }
    }
    const nav = doc.querySelector('.owner-workspace-navigation');
    if (nav) {
      const links = [ ['overview', 'Overview', 'business-workspace.html'], ['business-profile', 'My Business', 'marketing.html#business-profile'] ];
      if (state.status === 'ready') {
        links.push(['products', state.model === 'selling' ? 'Product Catalogue' : 'Products and Services', 'marketing.html#products']);
        if (state.model === 'marketing') links.push(['marketing', 'Marketing', 'marketing.html#overview'], ['results', 'Results', 'business-results.html']);
        else links.push(['product-options', 'Options and Availability', 'marketing.html#product-options']);
      }
      nav.replaceChildren();
      for (const [id, label, href] of links) { const a = doc.createElement('a'); a.dataset.ownerSection = id; a.textContent = label; a.href = href; nav.appendChild(a); }
      nav.style.setProperty('--owner-nav-columns', String(links.length));
      nav.style.setProperty('--owner-nav-template', links.length === 5 ? '1fr .9fr 1.4fr 1fr .8fr' : 'repeat(' + links.length + ',minmax(0,1fr))');
      root.updateOwnerNavigation?.(doc, root.location);
    }
    const header = doc.querySelector('.restaurant-name');
    if (header) header.textContent = state.model === 'marketing' ? 'Marketing workspace' : state.model === 'selling' ? 'Selling workspace' : 'Business workspace';
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
  const api = {resolve, canOpen, apply, getState, messages};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DEMEOSOwnerWorkspace = api;
})(typeof window !== 'undefined' ? window : globalThis);
