'use strict';
// Explicit, request-only sharing. No inherited ROOT organisation membership,
// persistence, GPU reservation or catalogue write permissions.
const {isolatedTestEnvironment,dataEnvironment}=require('./selling-access');
const {catalogueRevision}=require('./vendor-inventory');
const {applicationAccess}=require('./business-application-access');
const {getCategory}=require('./marketing-agent-categories');
function permitted(profile,identity,env){return profile&&dataEnvironment(profile.businessId,env,identity)&&(dataEnvironment(profile.businessId,env,identity)==='test'||applicationAccess({businessProfile:profile},profile.businessId).selling);}
async function run({repository,identity,env,body,analyze,visualRunnerFactory=require('./selling-visual-runtime').createConfiguredVisualRunner}){
 const allowed=body.action==='selling-options'?['action','audience','confirmed']:['action','audience','confirmed','businessId','productId','revision','locale'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||body.audience!=='business'||body.confirmed!==true)return {status:400,code:'explicit-sharing-required'};
 if(env.VERCEL_ENV!=='preview'||!isolatedTestEnvironment(env))return {status:503,code:'isolated-preview-required'};
 const store=repository();
 if(body.action==='selling-options'){
  const profiles=await store.getOwnedBusinessProfiles(identity);const products=[];
  for(const profile of profiles){
   if(!permitted(profile,identity,env)||!await store.isBusinessOwnedByIdentity(identity,profile.businessId))continue;
   for(const product of profile.products||[]){
    if(products.length>=250)return {status:503,code:'integration-selection-limit'};
    products.push({businessId:profile.businessId,businessName:profile.name,productId:product.productId,name:product.name,revision:catalogueRevision(product)});
   }
  }
  return {status:200,code:'selling-options',products};
 }
 if(!['understand-selling','visual-selling'].includes(body.action)||typeof body.businessId!=='string'||body.businessId.length>200||typeof body.productId!=='string'||body.productId.length>200||typeof body.revision!=='string'||body.revision.length>200)return {status:400,code:'invalid-request'};
 if(!await store.isBusinessOwnedByIdentity(identity,body.businessId))return {status:403,code:'integration-access-denied'};
 const profile=(await store.getKnownBusiness(body.businessId))?.businessProfile;
 if(!permitted(profile,identity,env))return {status:403,code:'integration-access-denied'};
 const product=profile.products?.find(p=>p.productId===body.productId);
 if(!product)return {status:403,code:'integration-access-denied'};
 if(catalogueRevision(product)!==body.revision)return {status:409,code:'source-changed'};
 const text=[product.name,product.description].filter(x=>typeof x==='string'&&x.trim()).join('\n');
 const result=analyze({action:'understand',audience:'business',locale:body.locale,text,categoryId:getCategory(product.classification?.categoryId)?product.classification.categoryId:''});
 if(!result)return {status:400,code:'source-exceeds-text-contract'};
 // Revoke access immediately on changed ownership/grants or source revision.
 const current=(await store.getKnownBusiness(body.businessId))?.businessProfile;
 const currentProduct=current?.products?.find(p=>p.productId===body.productId);
 if(!await store.isBusinessOwnedByIdentity(identity,body.businessId)||!permitted(current,identity,env))return {status:403,code:'integration-access-denied'};
 if(!currentProduct||catalogueRevision(currentProduct)!==body.revision)return {status:409,code:'source-changed'};
 if(body.action==='visual-selling'){
  // This is an explicit delegated Selling capability, not generic ROOT access
  // to Selling storage. Existing media checks, budget and executor remain sole authority.
  const backend=require('./selling-media').mediaBackend(env);
  const runner=visualRunnerFactory({store,environment:env,backend});
  if(!runner)return {status:503,code:'root-model-unavailable'};
  const assets=await store.getSellingIntelligenceMedia(identity,body.businessId,currentProduct);
  const visual=await runner.analyze({profile:current,product:currentProduct,assets,identity,outputLocale:body.locale});
  if(visual.status!=='succeeded')return {status:503,code:'root-model-unavailable'};
  // Model response is already schema/evidence/provenance/deadline validated by
  // the existing runner. It remains an unverified suggestion requiring review.
  if(!await store.isBusinessOwnedByIdentity(identity,body.businessId))return {status:403,code:'integration-access-denied'};
  const latest=(await store.getKnownBusiness(body.businessId))?.businessProfile;
  const latestProduct=latest?.products?.find(p=>p.productId===body.productId);
  if(!permitted(latest,identity,env))return {status:403,code:'integration-access-denied'};
  if(!latestProduct||catalogueRevision(latestProduct)!==body.revision)return {status:409,code:'source-changed'};
  return {status:200,code:'visual-suggestions-require-review',result:{...result,engine:{kind:'demeos-operated-open-weight',modelExecuted:true,modelId:visual.provenance.modelId,modelVersion:visual.provenance.modelVersion},visual,
    source:{...result.source,kind:'explicit-selling-share',businessId:profile.businessId,productId:product.productId,revision:body.revision},limitations:['model-suggestions-unverified','no-commercial-writeback','controlled-preview-only']}};
 }
 return {status:200,code:'understanding-complete',result:{...result,source:{...result.source,kind:'explicit-selling-share',businessId:profile.businessId,productId:product.productId,revision:body.revision}}};
}
module.exports={run};
