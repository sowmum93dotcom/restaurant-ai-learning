'use strict';
// Server-owned lifecycle on the existing product record. No provider, endpoint,
// credential or approval flag can be installed by an HTTP request.
const {createHash,randomUUID}=require('node:crypto');
const registry=require('./marketing-agent-categories');
const inventory=require('./vendor-inventory');
const {dataEnvironment}=require('./selling-access');
const RULESET='selling-submission-v1';
const STATES=Object.freeze(['draft','validating','approved','published','changes-required','review-required','rejected']);
const MANDATORY=Object.freeze(['content-safety','category-fit','media-consistency']);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
 return value;
}
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function content(product){const next=structuredClone(product);delete next.submission;delete next.customerVisible;delete next.imageUrl;delete next.imageSource;delete next.stockQuantity;delete next.stockHistory;return next;}
const contentHash=product=>hash(content(product));
function event(state,product,businessId,actor,type,now){
 return {eventId:randomUUID(),type,at:now,actor,businessId,productId:product.productId,version:state.version,contentHash:contentHash(product),state:state.state};
}
function draft(product,businessId,actor,now=new Date().toISOString()){
 const state={schemaVersion:1,ruleset:RULESET,state:'draft',version:1,contentHash:contentHash(product),createdAt:now,updatedAt:now,history:[]};
 state.history.push(event(state,product,businessId,actor,'draft-created',now));return state;
}
// Ordinary authoring APIs cannot import or overwrite server review decisions.
function reconcile(previous,next,businessId,actor,type='product-edited',now=new Date().toISOString()){
 const result=structuredClone(next),prior=previous?.submission;
 delete result.submission;
 if(!prior)return result;
 result.submission=structuredClone(prior);result.customerVisible=false;
 if(contentHash(previous)!==contentHash(result)){
  const s=result.submission;
  s.state='draft';s.version++;s.contentHash=contentHash(result);s.updatedAt=now;
  delete s.review;delete s.validation;delete s.attempt;delete s.approvedAt;
  s.history.push(event(s,result,businessId,actor,type,now));
 }
 return result;
}
function categoryReference(value){
 if(value===null)return null;
 const ref=registry.validateReference({categoryId:value?.categoryId,sectorId:value?.sectorId});
 return ref&&value.datasetVersion===registry.DATASET_VERSION?{...ref,datasetVersion:registry.DATASET_VERSION}:null;
}
function mediaEvidence(product,businessId,assets){
 const ids=product.mediaGallery?.assetIds||[],main=product.mediaGallery?.mainAssetId;
 const related=assets.filter(a=>a.relatedEntityId===product.productId&&a.state!=='archived');
 const required=product.presentation?.kind!=='service';
 const complete=related.every(a=>{
  const prefix=`businesses/${encodeURIComponent(businessId)}/media/${encodeURIComponent(a.assetId)}/`;
  const roles=new Set((a.derivatives||[]).map(d=>d.role));
  return a.businessId===businessId&&['product','service'].includes(a.purpose)&&a.state==='ready'&&a.sizeBytes>0&&a.width>0&&a.height>0&&
   a.storageKey?.startsWith(prefix)&&a.processedStorageKey?.startsWith(prefix+'processed/')&&
   (a.kind==='image'?['thumbnail','customer','marketing']:['customer','marketing']).every(r=>roles.has(r))&&a.derivatives.every(d=>d.storageKey?.startsWith(prefix+'processed/'))&&
   (a.kind==='image'?['image/jpeg','image/png','image/webp'].includes(a.contentType):a.kind==='video'&&['video/mp4','video/quicktime'].includes(a.contentType)&&a.durationSeconds>0&&a.durationSeconds<=60);
 });
 const linked=ids.every(id=>related.some(a=>a.assetId===id));
 const mainReady=related.some(a=>a.assetId===main&&a.kind==='image'&&ids.includes(a.assetId));
 return {passed:complete&&linked&&(!required||ids.length>0&&mainReady),assets:related.map(a=>({assetId:a.assetId,kind:a.kind,state:a.state,linked:ids.includes(a.assetId)})),fingerprint:hash(related.map(a=>({assetId:a.assetId,state:a.state,etag:a.etag,processedStorageKey:a.processedStorageKey,derivatives:a.derivatives})).sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:0))};
}
function deterministic({profile,product,assets,stock,environment,identity}){
 const scope=dataEnvironment(profile.businessId,environment,identity);
 const eligible=product.businessId===profile.businessId&&(scope==='test'||scope==='live'&&profile.applicationAccess?.selling===true&&!/^test-/i.test(product.productId));
 const price=product.price||'',mode=product.priceMode||'contact';
 const numeric=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/;
 const range=price.match(/^(\d+(?:\.\d{1,2})?)\s*[-–]\s*(\d+(?:\.\d{1,2})?)$/);
 const pricing=mode==='contact'?!price:['fixed','from'].includes(mode)?numeric.test(price):mode==='range'&&range&&Number(range[1])<=Number(range[2]);
 const rows=inventory.rowsFor({...profile,products:[product]},inventory.entriesWithLegacyStock(profile,stock.entries));
 const media=mediaEvidence(product,profile.businessId,assets);
 const rules=[['business-eligibility',eligible],['required-data',Boolean(product.name?.trim()&&product.description?.trim())],['category-integrity',Boolean(categoryReference(product.classification))],['pricing',Boolean(pricing)],['media-integrity',media.passed],['stock-availability',['available','limited','contact','unavailable'].includes(product.availability)&&rows.every(r=>!r.blocked&&(r.onHand===null||Number.isSafeInteger(r.onHand)&&Number.isSafeInteger(r.reserved)&&r.reserved>=0&&r.onHand>=r.reserved&&!(product.availability==='available'&&r.available===0)))]];
 return {rules:rules.map(([id,passed])=>({id,status:passed?'passed':'failed',code:id})),media,scope};
}
// The current shared semantic provider is category-understanding only and its
// registry installs no provider. It is NOT a safety/media approval capability.
// A future approved server service must supply exact-purpose, exact-version
// receipts below. Plain model prose or a browser flag is never evidence.
async function evaluate(input,resolveEvidence=async()=>null){
 const checked=deterministic(input),request={purpose:'selling-product-validation',ruleset:RULESET,businessId:input.profile.businessId,productId:input.product.productId,version:input.product.submission.version,contentHash:contentHash(input.product),mediaFingerprint:checked.media.fingerprint,environment:checked.scope};
 const rules=checked.rules.slice();
 for(const id of MANDATORY){
  if(id==='media-consistency'&&!checked.media.assets.length&&input.product.presentation?.kind==='service'){rules.push({id,status:'passed',code:'not-applicable'});continue;}
  let receipt=null;
  // Do not send incomplete/private submissions to an intelligence service.
  if(!rules.some(r=>r.status==='failed')){let timer;try{receipt=await Promise.race([resolveEvidence(Object.freeze({...request,rule:id})),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2000);})]);}catch{}finally{clearTimeout(timer);}}
  const valid=receipt&&receipt.purpose===request.purpose&&receipt.rule===id&&receipt.ruleset===RULESET&&receipt.businessId===request.businessId&&receipt.productId===request.productId&&receipt.version===request.version&&receipt.contentHash===request.contentHash&&receipt.mediaFingerprint===request.mediaFingerprint&&receipt.environment===request.environment&&receipt.independentlyVerified===true&&typeof receipt.authorityDecisionId==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(receipt.authorityDecisionId)&&typeof receipt.capabilityVersion==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(receipt.capabilityVersion)&&Date.parse(receipt.expiresAt)>Date.now()&&['passed','failed','rejected'].includes(receipt.outcome);
  rules.push({id,status:valid?(receipt.outcome==='passed'?'passed':'failed'):'unavailable',code:valid?'verified-decision':'capability-unavailable',...(valid?{authorityDecisionId:receipt.authorityDecisionId,capabilityVersion:receipt.capabilityVersion,expiresAt:receipt.expiresAt,nonRecoverable:receipt.outcome==='rejected'}:{})});
 }
 const state=rules.some(r=>r.nonRecoverable)?'rejected':rules.some(r=>r.status==='failed')?'changes-required':rules.some(r=>r.status!=='passed')?'review-required':'approved';
 return {...request,rules,state,media:checked.media.assets,checkedAt:new Date().toISOString(),stockRevision:input.stock.revision};
}
async function inputs(store,profile,product,environment,identity){
 const assets=await store.getBusinessMediaAssets(profile.businessId,1000);
 const stock=await store.getVendorInventory(profile.businessId);
 return {store,profile,product,assets,stock,environment,identity};
}
function replace(profile,product){return {...profile,products:profile.products.map(p=>p.productId===product.productId?product:p)};}
function publicationEligible({profile,product,environment,identity,assets,stock}){
 if(!profile||!product||!environment||!Array.isArray(assets)||!stock)return false;
 const s=product.submission,p=s?.publication;
 if(!p||p.state!=='published'||p.ruleset!==RULESET||p.environment!=='live'||p.deploymentEnvironment!=='production'||environment.VERCEL_ENV!=='production'||dataEnvironment(profile.businessId,environment,identity)!=='live'||profile.applicationAccess?.selling!==true)return false;
 const validation=p.validation;
 if(!validation||validation.state!=='approved'||validation.purpose!=='selling-product-validation'||validation.ruleset!==RULESET||validation.businessId!==profile.businessId||validation.productId!==product.productId||p.snapshot?.productId!==product.productId||validation.version!==p.version||validation.contentHash!==p.contentHash||validation.mediaFingerprint!==p.mediaFingerprint||validation.environment!==p.environment)return false;
 const expected=['business-eligibility','required-data','category-integrity','pricing','media-integrity','stock-availability',...MANDATORY];
 if(!Array.isArray(validation.rules)||!Array.isArray(validation.media)||validation.rules.length!==expected.length||expected.some(id=>!validation.rules.some(r=>r.id===id&&r.status==='passed')))return false;
 for(const id of MANDATORY){const rule=validation.rules.find(r=>r.id===id);if(rule.code==='not-applicable'){if(id!=='media-consistency'||p.snapshot.presentation?.kind!=='service'||validation.media?.length!==0)return false;}else if(!rule.authorityDecisionId||!rule.capabilityVersion||!(Date.parse(rule.expiresAt)>Date.now()))return false;}
 const saved={...p.snapshot,submission:{version:p.version}};
 const approvedAssets=new Set((p.validation?.media||[]).map(a=>a.assetId));
 const checks=deterministic({profile,product:saved,environment,identity,assets:assets.filter(a=>approvedAssets.has(a.assetId)),stock});
 return contentHash(saved)===p.contentHash&&checks.rules.every(r=>r.status==='passed')&&p.mediaFingerprint===checks.media.fingerprint;
}
async function mutate({store,profile,productId,action,identity,environment,confirmed,resolveEvidence}){
 const index=profile.products.findIndex(p=>p.productId===productId);
 if(index<0)return {status:404,code:'not-found'};
 let product=structuredClone(profile.products[index]),s=product.submission;
 if(!s){s=draft(product,profile.businessId,identity);product.submission=s;product.customerVisible=false;}
 const now=new Date().toISOString();let evidenceGuard;
 const save=(before,next)=>store.saveSellingProducts(identity,profile.businessId,before,replace(before,next),evidenceGuard);
 if(action==='review-product'){
  const checked=deterministic(await inputs(store,profile,product,environment,identity));
  s.history.push(event(s,product,profile.businessId,identity,'vendor-review-completed',now));
  s.review={version:s.version,contentHash:contentHash(product),reviewedAt:now,rules:checked.rules,media:checked.media.assets};s.updatedAt=now;
  if(!await save(profile,product))return {status:409,code:'conflict'};
  return {status:200,ok:true,state:s.state};
 }
 if(action==='unpublish-product'){
  if(s.publication?.state!=='published')return {status:200,ok:true,state:s.state};
  s.publication={...s.publication,state:'revoked',revokedAt:now,revokedBy:identity};
  if(s.state==='published')s.state='approved';s.updatedAt=now;
  s.history.push(event(s,product,profile.businessId,identity,'publication-revoked',now));
 }else if(action==='submit-product'){
  if(s.state==='rejected')return {status:409,code:'rejected'};
  if(s.validation?.contentHash===contentHash(product)&&s.attempt?.reviewedAt===s.review?.reviewedAt&&['approved','published','review-required','changes-required'].includes(s.state))return {status:200,ok:true,state:s.state};
  if(s.state==='validating'&&Date.now()-Date.parse(s.attempt?.startedAt)<30000)return {status:202,ok:true,state:'validating'};
  if(confirmed!==true||s.review?.version!==s.version||s.review.contentHash!==contentHash(product))return {status:400,code:'must-review'};
  s.state='validating';s.updatedAt=now;s.attempt={id:randomUUID(),startedAt:now,reviewedAt:s.review.reviewedAt};
  s.history.push(event(s,product,profile.businessId,identity,'submission-requested',now),event(s,product,profile.businessId,'demeos-validation','validation-started',now));
  const started=await save(profile,product);if(!started)return {status:409,code:'conflict'};
  profile=started;
  let checked;
  try{checked=await evaluate(await inputs(store,profile,product,environment,identity),resolveEvidence);}catch{
   checked={state:'review-required',rules:[{id:'validation-interrupted',status:'unavailable',code:'capability-unavailable'}],contentHash:contentHash(product),checkedAt:new Date().toISOString()};
  }
  // Any edit, stock adjustment, media change, grant revocation or superseding
  // attempt while checks run makes this result stale, never an approval.
  const fresh=(await store.getKnownBusiness(profile.businessId))?.businessProfile;
  if(!fresh||hash(fresh)!==hash(profile))return {status:409,code:'conflict'};
  const currentInput=await inputs(store,profile,product,environment,identity);
  if(checked.stockRevision!==currentInput.stock.revision||checked.mediaFingerprint!==deterministic(currentInput).media.fingerprint){checked.state='review-required';checked.rules.push({id:'evidence-changed',status:'unavailable',code:'conflict'});}
  evidenceGuard={inventoryRevision:currentInput.stock.revision,assets:currentInput.assets};
  s.state=checked.state;s.validation=checked;s.updatedAt=new Date().toISOString();
  if(s.state==='approved')s.approvedAt=s.updatedAt;
  s.history.push({...event(s,product,profile.businessId,'demeos-validation',s.state==='approved'?'validation-passed':'validation-failed',s.updatedAt),attemptId:s.attempt.id,rules:checked.rules});
  s.history.push(event(s,product,profile.businessId,'demeos-validation',s.state==='approved'?'automatic-approval-granted':'validation-held',s.updatedAt));
 }else if(action==='publish-product'){
  if(s.state==='published'&&s.publication?.version===s.version)return {status:200,ok:true,state:'published'};
  if(s.state!=='approved'||s.validation?.state!=='approved'||s.validation.contentHash!==contentHash(product))return {status:409,code:'not-approved'};
  const current=await inputs(store,profile,product,environment,identity),checks=deterministic(current);
  if(!checks.scope||checks.rules.some(r=>r.status!=='passed')||checks.media.fingerprint!==s.validation.mediaFingerprint||s.validation.rules.some(r=>r.status!=='passed'||r.expiresAt&&Date.parse(r.expiresAt)<=Date.now()))return {status:409,code:'must-review'};
  evidenceGuard={inventoryRevision:current.stock.revision,assets:current.assets};
  s.state='published';s.updatedAt=now;
  s.publication={state:'published',ruleset:RULESET,environment:checks.scope,deploymentEnvironment:environment.VERCEL_ENV||'development',version:s.version,contentHash:contentHash(product),snapshot:content(product),mediaFingerprint:checks.media.fingerprint,validation:structuredClone(s.validation),publishedAt:now,publishedBy:identity};
  s.history.push(event(s,product,profile.businessId,identity,'publication-completed',now));
 }else return {status:400,code:'invalid-action'};
 if(!await save(profile,product))return {status:409,code:'conflict'};
 return {status:200,ok:true,state:s.state};
}
module.exports={RULESET,STATES,MANDATORY,contentHash,categoryReference,draft,reconcile,deterministic,evaluate,mutate,publicationEligible};
