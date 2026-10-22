'use strict';
// ROOT owns orchestration, not a second taxonomy or a second model executor.
const {randomUUID, createHash}=require('node:crypto');
const registry=require('./marketing-agent-categories');
const fields=require('./selling-category-fields');
const {interpretCategories}=require('./customer-category-classification');
const authentication=require('./demeos-authentication');
const LOCALES=Object.freeze(['en','es','fr','ar','pt','zh','hi','de','ja','tr']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function capabilityMap(){
  return registry.CATEGORIES.map(category=>({categoryId:category.categoryId,sectorId:category.sectorId,name:category.categoryName,
    capabilities:{'literal-category-evidence':'available-english-canonical-name','field-checklist':fields.definition(category.categoryId).fields.length?'available-reviewed-fields':'not-reviewed',
      'image-understanding':'unavailable','video-understanding':'unavailable','model-recommendations':'unavailable'},
    fields:fields.definition(category.categoryId).fields.map(({key,label,required,maxLength})=>({key,label,required,maxLength}))}));
}
function workspace(identity,audience){
  // Personal workspaces only. Selecting Business is NOT an organisation grant.
  return {workspaceId:'root-'+createHash('sha256').update(JSON.stringify(['root-personal-v1',identity,audience])).digest('hex'),
    kind:'personal',audience,permissions:['understand-supplied-text'],organisationAccess:false};
}
function analyze(input){
  if(!plain(input)||Object.keys(input).some(k=>!['action','audience','locale','text','categoryId'].includes(k))||input.action!=='understand'||!['business','customer'].includes(input.audience)||!LOCALES.includes(input.locale)||typeof input.text!=='string'||!input.text.trim()||input.text.length>500||typeof input.categoryId!=='string'||(input.categoryId&&!registry.getCategory(input.categoryId)))return null;
  const text=input.text.trim();
  const interpretation=interpretCategories(text);
  const selected=input.categoryId?registry.getCategory(input.categoryId):null;
  return {requestId:randomUUID(),schemaVersion:1,engine:{kind:'deterministic',version:'root-understanding-v1',modelExecuted:false,datasetVersion:registry.DATASET_VERSION},
    audience:input.audience,locale:input.locale,source:{kind:'user-supplied',text,verified:false},
    literalCategoryEvidence:interpretation.categoryIds.map(id=>({categoryId:id,name:registry.getCategory(id).categoryName,evidence:text})),
    selectedCategory:selected?{categoryId:selected.categoryId,name:selected.categoryName,source:'user-selection',verified:false}:null,
    checklist:selected?fields.definition(selected.categoryId).fields.map(({key,label,required})=>({key,label,required,status:'requires-user-evidence'})):[],
    limitations:['canonical-english-matching-only','supplied-text-not-independent-evidence','no-model-inference','no-commercial-writeback'],
    review:{status:'not-saved',requiresUserCorrection:true},persistence:'none'};
}
function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest,environment=()=>process.env,repository=()=>require('./persistence').getRepository()}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie, Authorization');
    const reply=(status,code,data={})=>res.status(status).json({code,...data});
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(405,'method-not-allowed');}
    if(!['preview','development'].includes(environment().VERCEL_ENV))return reply(503,'root-preview-only');
    // Require same-origin JSON for mutation-like requests, even though this slice writes nothing.
    if(req.method==='POST'&&(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||'')||req.headers?.['sec-fetch-site']==='cross-site'))return reply(403,'request-not-allowed');
    try{
      const identity=await authenticate(req);
      if(typeof identity?.trustedIdentityId!=='string'||!identity.trustedIdentityId)return reply(401,'sign-in-required');
      const audience=req.method==='GET'?req.query?.audience:req.body?.audience;
      if(!['business','customer'].includes(audience))return reply(400,'audience-required');
      const context=workspace(identity.trustedIdentityId,audience);
      if(req.method==='GET'){
        if(Object.keys(req.query||{}).some(k=>!['resource','audience'].includes(k)))return reply(400,'invalid-request');
        return reply(200,'root-workspace',{workspace:context,registry:{datasetVersion:registry.DATASET_VERSION,sectors:registry.SECTORS,categories:capabilityMap()},locales:LOCALES,
          runtime:{status:'unavailable',reason:'root-model-acceptance-pending',hostedInferenceFallback:false},history:{status:'unavailable',reason:'persistence-review-pending'}});
      }
      if(plain(req.body)&&['selling-options','understand-selling'].includes(req.body.action)){
        if(audience!=='business'||req.body.confirmed!==true)return reply(403,'explicit-sharing-required');
        const {status,code,...data}=await require('./root-selling-integration').run({repository,identity:identity.trustedIdentityId,env:environment(),body:req.body,analyze});
        return reply(status,code,{workspace:context,...data});
      }
      const result=analyze(req.body);
      if(!result)return reply(400,'invalid-request');
      // No repository, cache, model transport or client-supplied tenant authority.
      return reply(200,'understanding-complete',{workspace:context,result});
    }catch{return reply(503,'root-unavailable');}
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.analyze=analyze;
module.exports.capabilityMap=capabilityMap;
module.exports.workspace=workspace;
module.exports.LOCALES=LOCALES;
