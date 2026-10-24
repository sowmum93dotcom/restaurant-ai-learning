'use strict';
const auth=require('./demeos-authentication'),access=require('./selling-access');
// No repository import: this diagnostic must never initialise/migrate SQL.
function createHandler({authenticate=auth.resolveTrustedIdentityFromRequest,environment=()=>process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({code:'method-not-allowed'});
  const env=environment();if(env.VERCEL_ENV!=='preview')return res.status(404).json({code:'not-found'});
  const identity=await authenticate(req);if(!identity)return res.status(401).json({code:'authentication-required'});
  let grant;try{grant=JSON.parse(env.DEMEOS_SELLING_TEST_AUTHORIZATIONS||'[]').find(g=>g.ownerIdentityId===identity.trustedIdentityId&&g.businessId===req.query?.businessId);}catch{}
  if(!grant)return res.status(403).json({code:'test-grant-required'});
  const verified=access.isolatedTestEnvironment(env)&&access.dataEnvironment(grant.businessId,env,identity.trustedIdentityId)==='test';
  // Only a fingerprint is returned. Compare with the authorised Neon endpoint
  // inventory outside the app; no connection URL, credentials or hostname leaks.
  const host=verified?new URL(env.POSTGRES_URL).hostname:null;
  return res.status(verified?200:409).json({schemaVersion:1,verified,code:verified?'preview-runtime-host-verified':'preview-isolation-unverified',hostFingerprint:host?require('node:crypto').createHash('sha256').update(host.replace('-pooler.','.')).digest('hex'):null,commit:env.VERCEL_GIT_COMMIT_SHA||null,databaseAccessed:false});
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
