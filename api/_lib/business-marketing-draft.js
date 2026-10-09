'use strict';
const {normalizeMarketingMediaLinks} = require('./marketing-media-link');
// Deterministic formatting of authoritative business-provided facts only.
// No generated facts, image generation, network provider or publication.
function prepareBusinessDraft(record, businessId, productId, assetId, assets = []) {
  const profile = record?.businessProfile;
  if (!profile || profile.businessId !== businessId || typeof profile.name !== 'string') return null;
  const product = (Array.isArray(profile.products) ? profile.products : []).find(p => p && p.productId === productId && p.businessId === businessId);
  if (!product || !product.name || !product.description) return null;
  let media = [];
  if (assetId) {
    const owned = assets.find(a => a && a.assetId === assetId && a.businessId === businessId && a.relatedEntityId === productId && ['product','service'].includes(a.purpose));
    media = owned && normalizeMarketingMediaLinks([{assetId, role:'primary'}], businessId, [owned]);
    if (!media) return null;
  }
  const availability = {available:'Available',limited:'Limited availability',unavailable:'Not currently available',contact:'Contact the business to confirm availability'};
  const lines = [profile.name, product.name, product.description];
  if (product.price && product.priceMode !== 'contact') lines.push((product.priceMode === 'from' ? 'From ' : '') + product.price);
  else lines.push('Contact the business for pricing.');
  lines.push(availability[product.availability] || availability.contact);
  if (profile.location) lines.push(profile.location);
  const routes = {website:'Visit our website.',phone:'Call us for details.',whatsapp:'Contact us on WhatsApp.',email:'Email us for details.',booking:'Use our booking link.',visit:'Contact us before visiting.',quote:'Contact us for a quote.'};
  if (profile.customerContinuation?.routes?.includes(product.continuationRoute) && routes[product.continuationRoute]) lines.push(routes[product.continuationRoute]);
  return {campaign:lines.join('\n\n'), preparationOnly:true, productId, media};
}
module.exports = {prepareBusinessDraft};
