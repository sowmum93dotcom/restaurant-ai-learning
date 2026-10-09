/* One controller owns the customer screen, address and browser history.
 * Product addresses contain identifiers only. Restoration requires the validated
 * feed; history never grants content, authentication or payment permission. */
(function (root, doc) {
  'use strict';
  const links = doc.querySelectorAll('.customer-journey-nav a[href^="#"]');
  let restoring = false, restoreVersion = 0, restoredUrl = '';
  const itemHashes = new Set(['#product-experience', '#product-experience-options', '#purchase-preparation']);
  const get = id => doc.getElementById && doc.getElementById(id);

  function updateActiveSection(position = true) {
    const current = ['#intention', '#customer-intention-form'].includes(root.location.hash) ? '#intention' : '#discover';
    links.forEach(link => {
      const active = link.getAttribute('href') === current;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (!position || !['#discover', '#intention', '#customer-intention-form'].includes(root.location.hash)) return;
    root.requestAnimationFrame(() => {
      const section = doc.querySelector(current), header = doc.querySelector('.customer-header');
      if (!section || section.hidden || !header) return;
      root.scrollTo({ top: Math.max(0, root.scrollY + section.getBoundingClientRect().top - header.getBoundingClientRect().height), behavior: 'instant' });
    });
  }

  function render(position = true) {
    if (typeof root.applyCustomerSurfaceRoute === 'function') root.applyCustomerSurfaceRoute(doc, root.location.hash);
    updateActiveSection(position);
  }

  function navigate(hash, options = {}) {
    const url = new URL(root.location.href);
    url.hash = hash;
    if (!itemHashes.has(url.hash)) {
      url.searchParams.delete('product'); url.searchParams.delete('work'); url.searchParams.delete('resume');
    }
    if (url.href !== root.location.href) root.history[options.replace ? 'replaceState' : 'pushState'](itemHashes.has(url.hash) ? root.history.state : null, '', url.pathname + url.search + url.hash);
    restoredUrl = root.location.href; restoreVersion++;
    if (!itemHashes.has(url.hash)) root.DEMEOSCustomerPurchasePreparation?.cancelPending();
    render(); // Also handles a click whose hash already matches the address.
  }

  function product(work, item, options = {}) {
    if (!work?.workItemId || !item?.productId) return;
    const url = new URL(root.location.href);
    const same = url.searchParams.get('work') === work.workItemId && url.searchParams.get('product') === item.productId && itemHashes.has(url.hash);
    url.searchParams.set('work', work.workItemId); url.searchParams.set('product', item.productId);
    if (!options.preserveRoute) { url.searchParams.delete('resume'); url.hash = 'product-experience'; }
    const origin = same || restoring ? root.history.state?.demeosCustomerOrigin : root.location.hash === '#intention' ? '#intention' : '#discover';
    if (!restoring) root.history[same || options.replace ? 'replaceState' : 'pushState']({ ...root.history.state, demeosCustomerOrigin: origin }, '', url.pathname + url.search + url.hash);
    get('product-experience')?.setAttribute('data-return-route', origin || '#discover');
    restoredUrl = root.location.href;
    updateActiveSection(false);
  }

  function rememberSelection() {
    const active = root.DEMEOSCustomerItemPresentation?.snapshot();
    if (!active || !itemHashes.has(root.location.hash)) return;
    const quantity = get('purchase-preparation-quantity')?.querySelector('input');
    const selection = { work: active.work?.workItemId, product: active.product.productId, options: { ...active.selection }, quantity: quantity ? quantity.value : '1' };
    root.history.replaceState({ ...root.history.state, demeosCustomerSelection: selection }, '', root.location.href);
  }

  function restoreProduct() {
    if (!get('product-experience') || !itemHashes.has(root.location.hash)) return false;
    const url = new URL(root.location.href);
    if (url.searchParams.get('resume') === '1') return false;
    const work = url.searchParams.get('work'), productId = url.searchParams.get('product');
    if (!work || !productId) return false; // Legacy purchase returns use their validated draft.
    const card = Array.from(doc.querySelectorAll('.customer-discover-option, .customer-product-card')).find(node =>
      node.getAttribute('data-product-id') === productId && node.closest('[data-work-item-id]')?.getAttribute('data-work-item-id') === work);
    const api = root.DEMEOSCustomerProductExperience;
    if (!card || !api) return false;
    if (url.hash === '#purchase-preparation') return true; // The preparation controller validates its draft.
    const business = card.closest('[data-work-item-id]');
    const heading = ['.customer-possibility-provider', '.customer-business-name', '.customer-work-business-name'].map(selector => business.querySelector(selector)).find(Boolean);
    const action = card.querySelector('.customer-product-continue-action, a');
    const destination = action?.getAttribute('data-customer-destination') || action?.href || '';
    const saved = root.history.state?.demeosCustomerSelection;
    restoring = true;
    try {
      api.open(doc, { workItemId: work, businessName: heading?.textContent || '' }, api.productFromCard(card), destination);
      if (saved?.work === work && saved.product === productId) {
        const active = root.DEMEOSCustomerItemPresentation?.snapshot();
        const options = Object.fromEntries((active?.product.presentation.options || []).filter(field => field.values.some(value => value.value === saved.options?.[field.key])).map(field => [field.key, saved.options[field.key]]));
        root.DEMEOSCustomerItemPresentation?.selection(options);
        const input = get('purchase-preparation-quantity')?.querySelector('input');
        const quantity = Number(saved.quantity);
        if (input && Number.isInteger(quantity) && quantity >= 1 && quantity <= 20) input.value = String(quantity);
      }
    } finally { restoring = false; }
    render(false);
    return true;
  }

  function restore() {
    restoredUrl = root.location.href; restoreVersion++;
    root.DEMEOSCustomerPurchasePreparation?.cancelPending({ preserveResume: true });
    if (!restoreProduct()) render();
    if (root.location.hash === '#purchase-preparation') root.DEMEOSCustomerPurchasePreparation?.resume();
  }

  function returnFromProduct() {
    const origin = root.history.state?.demeosCustomerOrigin === '#intention' ? '#intention' : '#discover';
    const work = new URL(root.location.href).searchParams.get('work');
    navigate(origin);
    if (origin === '#intention') {
      const focused = get('customer-focused-possibility');
      (focused && !focused.hidden ? focused : get('customer-possibilities-heading'))?.focus({preventScroll:true});
    } else {
      root.requestAnimationFrame(()=>{
        const business=Array.from(doc.querySelectorAll('.customer-work-card')).find(card=>card.getAttribute('data-work-item-id')===work);
        business?.scrollIntoView({block:'start',behavior:'instant'});
        business?.focus({preventScroll:true});
      });
    }
  }
  root.DEMEOSCustomerNavigation = Object.freeze({ navigate, product, render, rememberSelection, returnFromProduct });
  root.addEventListener('hashchange', () => { if (!root.location.href || restoredUrl !== root.location.href) restore(); });
  root.addEventListener('popstate', restore);
  root.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  if (doc.addEventListener) {
    doc.addEventListener('click', event => {
      const link = event.target?.closest?.('a[href]');
      if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
      const href = link.getAttribute('href');
      if (!['#discover', '#intention', '#customer-intention-form'].includes(href)) return;
      event.preventDefault(); navigate(href);
    });
    const save = event => {
      if (!event.target?.closest?.('#product-experience')) return;
      const version = restoreVersion;
      root.queueMicrotask(() => { if (version === restoreVersion) rememberSelection(); });
    };
    doc.addEventListener('change', save); doc.addEventListener('input', save);
    doc.addEventListener('demeos:customer-work-loaded', async () => {
      const url = new URL(root.location.href);
      if (!restoreProduct() && itemHashes.has(root.location.hash) && url.searchParams.has('product') && url.searchParams.get('resume') !== '1') {
        const version = restoreVersion;
        // Revalidate a later-page search selection through the SAME search API.
        // History stores only the customer request, never catalogue authority.
        if (root.history.state?.demeosCustomerOrigin === '#intention' && root.DEMEOSCustomerSearchJourney) {
          const restored = await root.DEMEOSCustomerSearchJourney.restore(root.history.state.demeosCustomerSearch);
          if (version !== restoreVersion) return;
          if (restored && restoreProduct()) return;
        }
        navigate('#discover', { replace: true });
      }
    });
    doc.addEventListener('DOMContentLoaded', () => render(false));
  }
  updateActiveSection();
}(window, document));
