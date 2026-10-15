'use strict';
const authentication = require('./demeos-authentication');
const persistence = require('./persistence');
const {applicationAccess} = require('./business-application-access');
const {authorizeDemeosAction} = require('./demeos-authorization');
const {createAuthenticatedBusinessOwnerContext} = require('./demeos-actor-context');

// Test identities never grant access. Test businesses still need persisted
// ownership and the normal administrator-maintained Selling application grant.
// Use the existing shared schema in an isolated Preview database, never seed live.
function dataEnvironment(businessId, env) {
  const test = /^test-/i.test(businessId);
  if (!test) return env.DEMEOS_SELLING_DATA_ENVIRONMENT === 'test' ? null : 'live';
  if (!/^test-business-/i.test(businessId) || env.VERCEL_ENV !== 'preview' || env.DEMEOS_SELLING_DATA_ENVIRONMENT !== 'test') return null;
  try {
    const ids = JSON.parse(env.DEMEOS_SELLING_TEST_BUSINESS_IDS || '[]');
    return Array.isArray(ids) && ids.includes(businessId) ? 'test' : null;
  } catch { return null; }
}

function businessSummary(profile, env) {
  const id = profile?.businessId;
  if (typeof id !== 'string' || !id || !applicationAccess({businessProfile:profile}, id).selling) return null;
  const environment = dataEnvironment(id, env);
  return environment ? {businessId:id, name:profile.name || 'Unnamed business', type:profile.type || '', location:profile.location || '', dataEnvironment:environment} : null;
}

function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest, repository=()=>persistence.getRepository(), environment=()=>process.env}={}) {
  return async function sellingDashboard(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie, Authorization');
    if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method not allowed.'}); }
    try {
      const identity = await authenticate(req);
      if (!identity) return res.status(401).json({error:'Sign in to open your Selling dashboard.'});
      const selected = req.query?.businessId;
      if (selected !== undefined && (typeof selected !== 'string' || !selected || selected.length > 200)) return res.status(400).json({error:'Choose a valid business.'});
      const store = repository(), env = environment();
      // SQL ownership relationship is authoritative, never a role/header/URL claim.
      const owned = await store.getOwnedBusinessProfiles(identity.trustedIdentityId);
      const businesses = owned.map(profile=>businessSummary(profile,env)).filter(Boolean);
      if (selected && !businesses.some(b=>b.businessId===selected)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      const businessId = selected || (businesses.length === 1 ? businesses[0].businessId : null);
      let business = null;
      if (businessId) {
        // Recheck ownership and grant on selection, including a concurrent revocation.
        if (!await store.isBusinessOwnedByIdentity(identity.trustedIdentityId,businessId)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const actorContext = createAuthenticatedBusinessOwnerContext({trustedIdentityId:identity.trustedIdentityId,businessId});
        if (!authorizeDemeosAction({actorContext,businessId,action:'view-own-business-results'}).allowed) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const record = await store.getKnownBusiness(businessId);
        business = businessSummary(record?.businessProfile,env);
        if (!business || business.businessId !== businessId) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      }
      return res.status(200).json({contractVersion:1, vendor:{identityId:identity.trustedIdentityId}, businesses, business, phase:1});
    } catch {
      return res.status(503).json({error:'Your Selling dashboard could not load. Please retry.'});
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.dataEnvironment = dataEnvironment;
