'use strict';
const {normalizeMarketingMediaLinks} = require('./marketing-media-link');
const itemContract = require('../../js/customer-item-contract');
const {priceText} = require('../../js/business-product-preparation');
const itemCopy = require('../../js/demeos-item-presentation-copy').en;
// Deterministic formatting of authoritative business-provided facts only.
// No generated facts, image generation, network provider or publication.
function prepareBusinessDraft(record, businessId, productId, assetId, assets = []) {
  const profile = record?.businessProfile;
  if (!profile || profile.businessId !== businessId || typeof profile.name !== 'string') return null;
  const product = (Array.isArray(profile.products) ? profile.products : []).find(p => p && p.productId === productId && p.businessId === businessId);
  if (!product || !product.name || !product.description) return null;
  let media = [];
  if (assetId) {
    const owned = assets.find(a => a && a.assetId === assetId && a.businessId === businessId && a.relatedEntityId === productId && ['product','service'].includes(a.purpose) && (!product.presentation?.kind || product.presentation.kind===a.purpose));
    media = owned && normalizeMarketingMediaLinks([{assetId, role:'primary'}], businessId, [owned]);
    if (!media) return null;
  }
  const availability = {available:'Available',limited:'Limited availability',unavailable:'Not currently available',contact:'Contact the business to confirm availability'};
  const presentation = product.presentation === undefined ? null : itemContract.normalize(product.presentation);
  if (product.presentation !== undefined && !presentation) return null;
  const lines = [product.name, profile.name, product.description];
  if (presentation) lines.push(priceText(presentation.pricing));
  else if (product.price && product.priceMode !== 'contact') lines.push((product.priceMode === 'from' ? 'From ' : '') + product.price);
  else lines.push('Contact the business for pricing.');
  if (presentation) {
    for (const option of presentation.options) lines.push(itemCopy.fields[option.key] + ': ' + option.values.map(v=>v.label).join(', '));
    for (const variant of presentation.variants) {
      const labels=presentation.options.map(o=>o.values.find(v=>v.value===variant.selection[o.key]).label);
      lines.push(labels.join(' / ') + ': ' + priceText(variant.pricing) + '. ' + availability[product.availability==='unavailable'?'unavailable':variant.availability]);
    }
  }
  lines.push(presentation?.variants.length && product.availability!=='unavailable' ? 'Choose an option and confirm its availability with the business.' : availability[product.availability] || availability.contact);
  if (profile.location) lines.push(profile.location);
  const routes = {website:'Visit our website.',phone:'Call us for details.',whatsapp:'Contact us on WhatsApp.',email:'Email us for details.',booking:'Use our booking link.',visit:'Contact us before visiting.',quote:'Contact us for a quote.'};
  if (profile.customerContinuation?.routes?.includes(product.continuationRoute) && routes[product.continuationRoute]) lines.push(routes[product.continuationRoute]);
  const campaign=lines.join('\n\n');if(campaign.length>12000)return null;
  return {campaign, preparationOnly:true, productId, media};
}
module.exports = {prepareBusinessDraft};
