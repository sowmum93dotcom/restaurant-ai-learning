'use strict';
const authentication = require('./demeos-authentication');
const persistence = require('./persistence');
const {applicationAccess} = require('./business-application-access');
const {authorizeDemeosAction} = require('./demeos-authorization');
const {createAuthenticatedBusinessOwnerContext} = require('./demeos-actor-context');

// These server-only settings authorize exact Clerk identity/business pairs.
// They never replace Clerk verification or the persisted SQL owner relationship.
function isolatedTestEnvironment(env) {
  if (env.VERCEL_ENV !== 'preview' || env.DEMEOS_SELLING_DATA_ENVIRONMENT !== 'test' ||
      !env.DEMEOS_SELLING_TEST_PREVIEW_BRANCH || env.VERCEL_GIT_COMMIT_REF !== env.DEMEOS_SELLING_TEST_PREVIEW_BRANCH ||
      !env.DEMEOS_SELLING_TEST_DATABASE_HOST) return false;
  try {
    // @vercel/postgres createPool uses POSTGRES_URL. An environment label alone
    // cannot enable test grants while the adapter still points at shared data.
    const url = new URL(env.POSTGRES_URL);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === env.DEMEOS_SELLING_TEST_DATABASE_HOST;
  } catch { return false; }
}

function dataEnvironment(businessId, env, identityId) {
  const test = /^test-/i.test(businessId);
  if (!test) return env.DEMEOS_SELLING_DATA_ENVIRONMENT === 'test' ? null : 'live';
  if (!/^test-business-/i.test(businessId) || !isolatedTestEnvironment(env) || !identityId) return null;
  try {
    const grants = JSON.parse(env.DEMEOS_SELLING_TEST_AUTHORIZATIONS || '[]');
    return Array.isArray(grants) && grants.some(grant=>grant?.businessId === businessId && grant.ownerIdentityId === identityId) ? 'test' : null;
  } catch { return null; }
}

function businessSummary(profile, env, identityId) {
  const id = profile?.businessId;
  if (typeof id !== 'string' || !id) return null;
  const environment = dataEnvironment(id, env, identityId);
  // Real Selling approval remains unchanged. The explicit Preview test grant
  // has its own authority and never changes the real applicationAccess field.
  if (environment === 'live' && !applicationAccess({businessProfile:profile}, id).selling) return null;
  return environment ? {businessId:id, name:profile.name || 'Unnamed business', type:profile.type || '', location:profile.location || '', dataEnvironment:environment, products:Array.isArray(profile.products)?profile.products.map(p=>({productId:p.productId,name:p.name,description:p.description,price:p.price,priceMode:p.priceMode})):[]} : null;
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
      const env = environment();
      if (env.DEMEOS_SELLING_DATA_ENVIRONMENT === 'test' && !isolatedTestEnvironment(env)) return res.status(503).json({error:'The isolated Selling Preview is not configured.'});
      const store = repository();
      // SQL ownership relationship is authoritative, never a role/header/URL claim.
      const owned = await store.getOwnedBusinessProfiles(identity.trustedIdentityId);
      const businesses = owned.map(profile=>businessSummary(profile,env,identity.trustedIdentityId)).filter(Boolean);
      if (selected && !businesses.some(b=>b.businessId===selected)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      const businessId = selected || (businesses.length === 1 ? businesses[0].businessId : null);
      let business = null;
      if (businessId) {
        // Recheck ownership and the applicable server authority on every load.
        if (!await store.isBusinessOwnedByIdentity(identity.trustedIdentityId,businessId)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const actorContext = createAuthenticatedBusinessOwnerContext({trustedIdentityId:identity.trustedIdentityId,businessId});
        if (!authorizeDemeosAction({actorContext,businessId,action:'view-own-business-results'}).allowed) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const record = await store.getKnownBusiness(businessId);
        business = businessSummary(record?.businessProfile,env,identity.trustedIdentityId);
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
module.exports.isolatedTestEnvironment = isolatedTestEnvironment;
