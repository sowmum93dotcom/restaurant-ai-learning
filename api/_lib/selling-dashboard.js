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
  return environment ? {businessId:id, name:profile.name || 'Unnamed business', type:profile.type || '', location:profile.location || '', dataEnvironment:environment, products:Array.isArray(profile.products)?profile.products.map(p=>({productId:p.productId,name:p.name,description:p.description,price:p.price,priceMode:p.priceMode,availability:p.availability||'contact',stockQuantity:Number.isSafeInteger(p.stockQuantity)?p.stockQuantity:null,stockHistory:Array.isArray(p.stockHistory)?p.stockHistory:[]})):[]} : null;
}

function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest, repository=()=>persistence.getRepository(), environment=()=>process.env}={}) {
  return async function sellingDashboard(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie, Authorization');
    if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
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
      const businesses = owned.map(profile=>businessSummary(profile,env,identity.trustedIdentityId)).filter(Boolean).map(({products,...summary})=>summary);
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
      if (req.method === 'POST') {
        if (!businessId || !business) return res.status(403).json({error:'Select your business.'});
        const action=req.body?.action;
        const item=req.body?.product;
        if (!['save-product','delete-product','adjust-stock'].includes(action) || !item || typeof item!=='object' || Array.isArray(item))
          return res.status(400).json({error:'Invalid product request.'});
        const id=typeof item.productId==='string'?item.productId.trim():'';
        if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return res.status(400).json({error:'Invalid product ID.'});
        const original=(await store.getKnownBusiness(businessId))?.businessProfile;
        if (!original || !businessSummary(original,env,identity.trustedIdentityId))
          return res.status(403).json({error:'Business access unavailable.'});
        const products=Array.isArray(original.products)?original.products.slice():[];
        const index=products.findIndex(product=>product.productId===id);
        if (action==='adjust-stock') {
          if (index<0) return res.status(404).json({error:'Product not found.'});
          const quantity=item.quantity;
          const note=typeof item.note==='string'?item.note.trim():'';
          if (!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000||note.length<1||note.length>200)
            return res.status(400).json({error:'Enter a valid stock quantity and reason.'});
          const previous=products[index],oldQuantity=Number.isSafeInteger(previous.stockQuantity)?previous.stockQuantity:null;
          if (oldQuantity===quantity) return res.status(400).json({error:'Stock quantity has not changed.'});
          const history=Array.isArray(previous.stockHistory)?previous.stockHistory.slice(-99):[];
          history.push({from:oldQuantity,to:quantity,note,changedAt:new Date().toISOString(),changedBy:identity.trustedIdentityId});
          products[index]={...previous,stockQuantity:quantity,stockHistory:history};
        } else if (action==='delete-product') {
          if (index<0) return res.status(404).json({error:'Product not found.'});
          products.splice(index,1);
        } else {
          const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
          const name=clean(item.name,200),description=clean(item.description,1200);
          const price=clean(item.price,100),priceMode=clean(item.priceMode,20)||'contact';
          const availability=clean(item.availability,20)||'contact';
          if (!name || !description || !['contact','fixed','from','range'].includes(priceMode) || !['contact','available','unavailable'].includes(availability) ||
              (priceMode==='contact'&&price) || (priceMode!=='contact'&&!price))
            return res.status(400).json({error:'Invalid product details.'});
          if (index<0 && products.length>=100) return res.status(409).json({error:'Product limit reached.'});
          const previous=index>=0?products[index]:{};
          const product={...previous,productId:id,businessId,name,description,price,priceMode,customerVisible:index>=0?previous.customerVisible===true:false,
            availability};
          if (index<0) products.push(product); else products[index]=product;
        }
        const updated={...original,products};
        const saved=business.dataEnvironment==='test'
          ? await store.saveOwnedBusinessProfile(identity.trustedIdentityId,businessId,original,updated)
          : await store.saveSellingProducts(identity.trustedIdentityId,businessId,original,updated);
        if (!saved) return res.status(409).json({error:'Business changed. Reload and retry.'});
        return res.status(200).json({ok:true});
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
