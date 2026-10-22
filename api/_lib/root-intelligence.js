'use strict';
// ROOT owns orchestration, not a second taxonomy or a second model executor.
const {randomUUID, createHash}=require('node:crypto');
const registry=require('./marketing-agent-categories');
const fields=require('./selling-category-fields');
const {interpretCategories}=require('./customer-category-classification');
const authentication=require('./demeos-authentication');
const LOCALES=Object.freeze(['en','es','fr','ar','pt','zh','hi','de','ja','tr']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function persistenceAllowed(env,identity){
  try{return env.DEMEOS_ROOT_PERSISTENCE_ENABLED==='true'&&require('./selling-access').isolatedTestEnvironment(env)&&Array.isArray(JSON.parse(env.DEMEOS_ROOT_PREVIEW_OWNER_IDS||'null'))&&JSON.parse(env.DEMEOS_ROOT_PREVIEW_OWNER_IDS).includes(identity);}catch{return false;}
}
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
function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest,environment=()=>process.env,repository=()=>require('./persistence').getRepository(),workStore=()=>require('./root-work-store').createStore(require('./database').getDatabase()),visualRunnerFactory}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie, Authorization');
    const reply=(status,code,data={})=>res.status(status).json({code,...data});
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(405,'method-not-allowed');}
    if(!['preview','development'].includes(environment().VERCEL_ENV))return reply(503,'root-preview-only');
    // Signed-in ROOT mutations must never accept an explicit foreign browser Origin.
    // An absent Origin remains valid for existing reviewed non-browser callers.
    if(req.method==='POST'){
      if(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||'')||req.headers?.['sec-fetch-site']==='cross-site')return reply(403,'request-not-allowed');
      const origin=req.headers?.origin;
      if(origin!==undefined){
        const host=req.headers?.host;
        if(typeof origin!=='string'||typeof host!=='string'||!host||host.includes(',')||host.includes('/')||host.includes('\\'))return reply(403,'request-not-allowed');
        try{
          const parsed=new URL(origin);
          if(parsed.origin!==origin||parsed.host.toLowerCase()!==host.toLowerCase()||!['https:','http:'].includes(parsed.protocol))return reply(403,'request-not-allowed');
        }catch{return reply(403,'request-not-allowed');}
      }
    }
    try{
      const identity=await authenticate(req);
      if(typeof identity?.trustedIdentityId!=='string'||!identity.trustedIdentityId)return reply(401,'sign-in-required');
      const audience=req.method==='GET'?req.query?.audience:req.body?.audience;
      if(!['business','customer'].includes(audience))return reply(400,'audience-required');
      const context=workspace(identity.trustedIdentityId,audience);
      if(req.method==='GET'){
        if(Object.keys(req.query||{}).some(k=>!['resource','audience'].includes(k)))return reply(400,'invalid-request');
        const history=persistenceAllowed(environment(),identity.trustedIdentityId)?{status:'available',works:await workStore().list(identity.trustedIdentityId,context)}:{status:'unavailable',reason:'persistence-review-pending'};
        return reply(200,'root-workspace',{workspace:context,registry:{datasetVersion:registry.DATASET_VERSION,sectors:registry.SECTORS,categories:capabilityMap()},locales:LOCALES,
          runtime:{status:'unavailable',reason:'root-model-acceptance-pending',hostedInferenceFallback:false,controlledSellingVisual:persistenceAllowed(environment(),identity.trustedIdentityId)&&environment().DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED==='true'&&Boolean(require('./selling-visual-runtime').configuration(environment()))},history});
      }
      if(plain(req.body)&&['save-work','review-work'].includes(req.body.action)){
        if(!persistenceAllowed(environment(),identity.trustedIdentityId))return reply(503,'root-persistence-unavailable');
        if(req.body.confirmed!==true)return reply(400,'explicit-save-required');
        let saved;
        if(req.body.action==='save-work'){
          if(Object.keys(req.body).some(k=>!['action','audience','locale','text','categoryId','confirmed','requestId'].includes(k)))return reply(400,'invalid-request');
          const result=analyze({action:'understand',audience,locale:req.body.locale,text:req.body.text,categoryId:req.body.categoryId});
          if(!result)return reply(400,'invalid-request');
          saved=await workStore().save(identity.trustedIdentityId,context,req.body.requestId,result);
        }else{
          if(Object.keys(req.body).some(k=>!['action','audience','confirmed','workId','revision','decision','text'].includes(k)))return reply(400,'invalid-request');
          saved=await workStore().review(identity.trustedIdentityId,context,{workId:req.body.workId,revision:req.body.revision,decision:req.body.decision,text:req.body.text});
        }
        const codes={invalid:400,conflict:409,denied:403,limited:429,saved:201,reviewed:200};
        return reply(codes[saved.status]||503,'root-work-'+saved.status,{workspace:context,...(['saved','reviewed'].includes(saved.status)?{work:saved.work}: {})});
      }
      if(plain(req.body)&&req.body.action==='prepare-controlled-runtime'){
        if(Object.keys(req.body).some(k=>!['action','audience','confirmed'].includes(k))||audience!=='business'||req.body.confirmed!==true)return reply(400,'invalid-request');
        if(!persistenceAllowed(environment(),identity.trustedIdentityId)||environment().DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED!=='true')return reply(503,'root-model-unavailable');
        const health=await require('./root-runtime-health').check(environment());
        return reply(health.status==='ready'?200:503,'root-connection-'+health.status,{health});
      }
      if(plain(req.body)&&req.body.action==='visual-selling'){
        if(audience!=='business'||req.body.confirmed!==true)return reply(403,'explicit-sharing-required');
        if(!persistenceAllowed(environment(),identity.trustedIdentityId)||environment().DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED!=='true')return reply(503,'root-model-unavailable');
        if(!require('./root-work-store').validId(req.body.requestId)||req.body.saveConfirmed!==true)return reply(400,'explicit-save-required');
        const {requestId,saveConfirmed,...body}=req.body;
        const execution=await require('./root-selling-integration').run({repository,identity:identity.trustedIdentityId,env:environment(),body,analyze,visualRunnerFactory});
        if(execution.status!==200)return reply(execution.status,execution.code);
        const saved=await workStore().save(identity.trustedIdentityId,context,requestId,execution.result);
        if(saved.status!=='saved')return reply(503,'root-work-not-saved');
        return reply(201,'visual-suggestions-require-review',{workspace:context,result:saved.work.result,work:saved.work});
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
module.exports.persistenceAllowed=persistenceAllowed;
