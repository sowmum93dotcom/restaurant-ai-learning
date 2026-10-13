"use strict";
// Development UI sandbox. No repository, database, approval writer or payment service.
const fs = require('node:fs');
const path = require('node:path');
const {resolveTrustedIdentityFromRequest,getAllowedClerkPublishableKey} = require('./demeos-authentication');
const stock = require('./vendor-inventory');
const {validateProfile} = require('../businesses/[businessId]');
const BUSINESS = 'test-vendor-inspection-705';
const BRANCH = 'business-approval-application-access-705';
function enabled(env = process.env) {
  return env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === BRANCH;
}
function inspectionLinks(html) {
  return html.replace('data-owner-model="selling" data-selling-entry="true"','data-owner-model="none"')
    .replaceAll('href="/selling-vendor/manage','href="/selling-vendor/inspect/manage')
    .replaceAll('href="/selling-vendor/onboarding','href="/selling-vendor/inspect/manage')
    .replaceAll('href="/selling-vendor"','href="/selling-vendor/inspect"');
}
function fixture(origin) {
  const profile = {businessId: BUSINESS, name: 'Development sample shop', type: 'Clothing', location: 'Sample location', profileVersion: 4, preparationModel: 'selling', offeringCategoryId: 'fashion.apparel', productsServices: 'Controlled interface inspection data', customerContinuation: {routes:['website'],website:'https://example.org'}, fulfilment:{methods:['shipping']}, operationalAvailability:{status:'available'}, informationStatus:{source:'controlled-development-inspection',status:'business-provided',reviewState:'draft'}, products:[{businessId:BUSINESS,productId:'test-inspection-jacket',name:'Sample jacket — test product',description:'Controlled sample for product editor inspection. Not offered for sale.',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:false,presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'},{value:'L',label:'Large'}]}],variants:[{variantId:'test-medium',selection:{size:'M'},availability:'available'},{variantId:'test-large',selection:{size:'L'},availability:'available'}]},mediaGallery:{assetIds:['test-image-one','test-image-two','test-video'],mainAssetId:'test-image-one'}}]};
  const assets = [['test-image-one','image','vendor-inspection/sample-jacket-front.svg'],['test-image-two','image','vendor-inspection/sample-jacket-back.svg'],['test-video','video','vendor-inspection/sample-jacket.webm']].map(([assetId,kind,file])=>({assetId,kind,businessId:BUSINESS,relatedEntityId:'test-inspection-jacket',purpose:'product',state:'ready',originalFilename:assetId==='test-image-one'?'Test jacket — front view':assetId==='test-image-two'?'Test jacket — back view':'Test jacket — demonstration video',deliveryUrl:origin+'/images/'+file}));
  return {profile,assets,entries:{},revision:0,history:[]};
}
function record(state) {
  return {businessProfile:state.profile,campaigns:[],inspection:true,workspaceReadiness:{businessId:BUSINESS,onboarding:{status:'draft',approved:false,canSubmit:false,reviewAvailable:false},applications:{marketing:false,selling:false},marketing:{canPrepare:false},selling:{canPrepare:true,canSell:false,status:'development-inspection'},publication:{draftsPublic:false,submissionAvailable:false}}};
}
function operate(state, pathname, method, body) {
  const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
  if(!state || state.profile?.businessId!==BUSINESS || state.profile.preparationModel!=='selling' || state.profile.applicationAccess || state.profile.applicationDecisions || !Array.isArray(state.assets) || !Number.isInteger(state.revision) || !Array.isArray(state.history))fail('Invalid inspection state.');
  const snapshot=()=>stock.catalogueRevision(state.profile);
  const products=()=>({businessId:BUSINESS,products:state.profile.products,informationStatus:state.profile.informationStatus,catalogueRevision:snapshot()});
  const inventory=()=>({businessId:BUSINESS,revision:state.revision,catalogueRevision:snapshot(),rows:stock.rowsFor(state.profile,state.entries),history:state.history,sellingEnabled:false});
  if(pathname==='/api/businesses' && method==='GET')return {businesses:[state.profile]};
  if(pathname==='/api/businesses/'+BUSINESS && method==='GET')return record(state);
  const resource=pathname.replace('/api/businesses/'+BUSINESS+'/', '');
  if(resource==='orders' && method==='GET')return {businessId:BUSINESS,orders:[],sellingEnabled:false};
  if(resource==='media' && method==='GET')return {assets:state.assets};
  if(resource==='products' && method==='GET')return products();
  if(resource==='inventory' && method==='GET')return inventory();
  if(resource==='products' && method==='PUT'){
    if(body?.accuracyConfirmed!==true || body.catalogueRevision!==snapshot())fail('Reload the sample catalogue before saving.',409);
    const validated=validateProfile({body:{businessProfile:{...state.profile,products:body.products}},query:{businessId:BUSINESS}});
    if(!validated)fail('Check product names, descriptions, prices, options and fulfilment.');
    const candidate={...state.profile,products:validated.products};
    const rows=stock.rowsFor(candidate,state.entries);
    if(rows.some(row=>row.blocked))fail('Recorded stock options cannot be reassigned.',409);
    for(const product of candidate.products){const gallery=body.products.find(p=>p.productId===product.productId)?.mediaGallery;
      if(gallery){if(!Array.isArray(gallery.assetIds)||gallery.assetIds.length>20||new Set(gallery.assetIds).size!==gallery.assetIds.length||typeof gallery.mainAssetId!=='string'||gallery.assetIds.some(id=>!state.assets.some(a=>a.assetId===id&&a.relatedEntityId===product.productId&&a.state==='ready'))||(gallery.mainAssetId&&!state.assets.some(a=>a.assetId===gallery.mainAssetId&&a.kind==='image'&&gallery.assetIds.includes(a.assetId))))fail('Choose matching sample product media.');product.mediaGallery=gallery;}
    }
    state.profile=candidate;return products();
  }
  if(resource==='inventory' && method==='PUT'){
    if(body?.revision!==state.revision||body.catalogueRevision!==snapshot())fail('Stock or products changed. Reload before saving.',409);
    const changed=stock.applyChanges(state.profile,state.entries,body.changes);state.entries=changed.entries;state.revision++;
    state.history.unshift({revision:state.revision,recorded_at:new Date().toISOString(),changes:changed.audit});return inventory();
  }
  fail('This operation is unavailable in Development inspection.',403);
}
function createHandler({environment=()=>process.env,authenticate=resolveTrustedIdentityFromRequest}={}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(!enabled(environment()))return res.status(404).json({error:'Not found.'});
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
  const identity=await authenticate(req);
  if(!identity){
    if(req.method==='POST')return res.status(401).json({error:'Authentication required.',reason:'inspection-authentication-required'});
    if(!['dashboard','manage'].includes(req.query.page))return res.status(404).json({error:'Not found.'});
    // Reuse the existing Clerk sign-in boundary. No fixture is sent before sign-in.
    const destination=req.query.page==='manage'?'/selling-vendor/inspect/manage':'/selling-vendor/inspect';
    // A token becoming ready does not prove the next HTML request will authenticate.
    // Allow one automatic handoff; repeated unauthenticated shells recover explicitly.
    const handoff='<script>(function(){var key="demeos:inspection-handoff:705:"+window.location.pathname;window.DEMEOSVendorInspectionEntryRetry=function(){try{sessionStorage.removeItem(key);}catch(_){}window.location.reload();};document.addEventListener("owner-business-ready",function(){try{var previous=Number(sessionStorage.getItem(key)||0);if(previous&&Date.now()-previous<30000){document.dispatchEvent(new CustomEvent("owner-inspection-entry-failed"));return;}sessionStorage.setItem(key,String(Date.now()));}catch(_){document.dispatchEvent(new CustomEvent("owner-inspection-entry-failed"));return;}if(window.location.pathname==='+JSON.stringify(destination)+'&&!window.location.search)window.location.reload();else window.location.replace('+JSON.stringify(destination)+'+window.location.hash);},{once:true});})();</script>';
    const shell=inspectionLinks(fs.readFileSync(path.join(process.cwd(),'selling-vendor.html'),'utf8')).replace('<script src=', '<script>window.DEMEOSVendorInspectionEntry=true;</script><script src=').replace('</body>',handoff+'</body>');
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(200).send(shell);
  }
  if(req.method==='POST'){
    const host=req.headers['x-forwarded-host']||req.headers.host;
    try{if(new URL(req.headers.origin).host!==host)return res.status(403).json({error:'Same-origin inspection required.'});}catch(_){return res.status(403).json({error:'Same-origin inspection required.'});}
    if(req.body?.identityId!==identity.trustedIdentityId)return res.status(403).json({error:'Inspection account changed.',reason:'inspection-account-changed'});
    try{const {state,pathname,method,body}=req.body||{};const result=operate(state,pathname,method,body);return res.status(200).json({state,result});}catch(error){return res.status(error.status||400).json({error:error.message});}
  }
  if(!['dashboard','manage'].includes(req.query.page))return res.status(404).json({error:'Not found.'});
  const host=req.headers['x-forwarded-host']||req.headers.host;
  const publishable=getAllowedClerkPublishableKey(environment());
  const clerkHost=publishable ? Buffer.from(publishable.split('_')[2]||'','base64').toString('utf8').replace(/\$$/,'') : '';
  const bootstrap={identityId:identity.trustedIdentityId,clerkOrigin:'https://'+clerkHost,state:fixture('https://'+host)};
  const script='<script>window.DEMEOS_VENDOR_INSPECTION='+JSON.stringify(bootstrap).replace(/</g,'\\u003c')+';</script><script src="/js/vendor-inspection.js"></script>';
  let html=fs.readFileSync(path.join(process.cwd(),req.query.page==='manage'?'selling-vendor-manage.html':'selling-vendor.html'),'utf8');
  html=inspectionLinks(html).replace('<script src=',script+'<script src=');
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(200).send(html);
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.enabled=enabled;module.exports.fixture=fixture;module.exports.operate=operate;module.exports.record=record;
