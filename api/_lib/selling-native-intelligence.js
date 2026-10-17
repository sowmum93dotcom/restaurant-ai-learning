'use strict';
// Pure, bounded DEMEOS assistance. Never supplies publication validation receipts.
const {createHash}=require('node:crypto');
const registry=require('./marketing-agent-categories');
const {interpretCategories}=require('./customer-category-classification');
const fields=require('./selling-category-fields');
const submissions=require('./selling-submissions');
const mediaContract=require('./media-asset-contract');
const VERSION='selling-native-intelligence-v1';
const LIMITS=Object.freeze({products:10000,media:64,duplicates:25,text:500});
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function classify(product){
 const text=[product.name,product.description].filter(Boolean).join(' ').trim(),selected=product.classification?.categoryId;
 if(product.classification&&!submissions.categoryReference(product.classification))return {outcome:'unsupported',basis:'category-invalid',candidates:[]};
 if(text.length>LIMITS.text)return {outcome:'unsupported',basis:'classification-limit',candidates:[]};
 const result=interpretCategories(text),candidates=result.categoryIds.map(id=>({...registry.getCategory(id),basis:'canonical-name-with-negation-rules'}));
 return {outcome:!text||!candidates.length?'insufficient-information':selected&&!candidates.some(c=>c.categoryId===selected)?'conflicting-information':candidates.length===1?'rules-supported':'plausible-candidate',basis:result.source,candidates};
}
function duplicates(product,products,businessId){
 const title=normalize(product.name),sku=normalize(product.sku),category=product.classification?.categoryId;
 const matches=[];
 for(const p of products.slice(0,LIMITS.products)){
  if(p.productId===product.productId||p.businessId!==businessId)continue;
  const signals=[];
  if(sku&&sku===normalize(p.sku))signals.push('same-sku');
  if(title&&title===normalize(p.name)&&category&&category===p.classification?.categoryId)signals.push('same-title-and-category');
  if(signals.length)matches.push({productId:p.productId,name:String(p.name||'').slice(0,200),signals});
  if(matches.length===LIMITS.duplicates)break;
 }
 return matches;
}
function mediaAnalysis(product,assets,businessId){
 const findings=[],ids=product.mediaGallery?.assetIds||[],main=product.mediaGallery?.mainAssetId;
 const add=(id,field,status,severity='warning')=>findings.push({ruleId:id,field,status,severity,explanation:id,suggestedCorrection:status==='passed'?'none':'review-field'});
 const related=assets.filter(a=>a.businessId===businessId&&a.relatedEntityId===product.productId&&['product','service'].includes(a.purpose)&&a.state!=='archived').slice(0,LIMITS.media);
 const ownedIds=new Set(related.map(a=>a.assetId));
 add('media-relationship','mediaGallery',ids.every(id=>ownedIds.has(id))&&related.every(a=>ids.includes(a.assetId))?'passed':'failed','error');
 add('main-image','mediaGallery.mainAssetId',product.presentation?.kind==='service'||related.some(a=>a.assetId===main&&ids.includes(a.assetId)&&a.kind==='image'&&a.state==='ready')?'passed':'failed','error');
 const seen=new Set();
 for(const a of related){
  const field='media.'+a.assetId;
  add('media-processing',field,a.state==='ready'?'passed':a.state==='failed'?'failed':'unavailable','error');
  if(a.state!=='ready')continue;
  const image=a.kind==='image',video=a.kind==='video',types=image?mediaContract.IMAGE_CONTENT_TYPES:mediaContract.VIDEO_CONTENT_TYPES;
  const valid=(image||video)&&types.includes(a.contentType)&&Number.isSafeInteger(a.sizeBytes)&&a.sizeBytes>0&&a.sizeBytes<=(image?mediaContract.MAX_IMAGE_BYTES:mediaContract.MAX_VIDEO_BYTES)&&Number.isSafeInteger(a.width)&&a.width>0&&Number.isSafeInteger(a.height)&&a.height>0&&(!video||Number.isFinite(a.durationSeconds)&&a.durationSeconds>0&&a.durationSeconds<=mediaContract.MAX_VIDEO_DURATION_SECONDS);
  add('media-properties',field,valid?'passed':'failed','error');
  if(image&&a.width<mediaContract.RECOMMENDED_IMAGE_MIN_WIDTH)add('image-quality',field,'failed');
  // Equal private processed object references are evidence of a repeated asset,
  // not a claim of perceptual/semantic duplicate detection or an invented hash.
  if(a.processedStorageKey&&seen.has(a.processedStorageKey))add('media-duplicate',field,'failed');
  seen.add(a.processedStorageKey);
  if(video){
   const prefix=`businesses/${encodeURIComponent(businessId)}/media/${encodeURIComponent(a.assetId)}/processed/`;
   add('video-playback',field,a.processedStorageKey?.startsWith(prefix)&&a.derivatives?.some(d=>d.role==='customer'&&d.contentType==='video/mp4'&&d.storageKey?.startsWith(prefix))?'passed':'failed','error');
   if(!a.derivatives?.some(d=>['thumbnail','poster','cover'].includes(d.role)))add('video-cover',field,'unavailable','info');
  }
 }
 if(new Set(ids).size!==ids.length)add('media-duplicate','mediaGallery','failed');
 if(assets.length>LIMITS.media||ids.length>LIMITS.media)add('media-limit','mediaGallery','unavailable','error');
 return findings;
}
function fingerprint({profile,product,assets,stock}){
 // Profile hash invalidates duplicate/context changes; media metadata and stock
 // invalidate even when the product authoring revision is unchanged.
 return hash({version:VERSION,registry:registry.DATASET_VERSION,fields:fields.VERSION,profile,product,assets,stock});
}
function analyze({profile,product,assets=[],stock={revision:0,entries:{},history:[]},environment,identity,now=new Date().toISOString()}){
 if(!profile||product?.businessId!==profile.businessId||!Array.isArray(profile.products)||profile.products.length>LIMITS.products)throw Error('Invalid authorised intelligence input.');
 const started=performance.now(),findings=[];
 const add=(id,field,passed,severity='error')=>findings.push({ruleId:id,severity,field,status:passed?'passed':'failed',explanation:id,suggestedCorrection:passed?'none':'review-field'});
 const prerequisites=submissions.deterministic({profile,product,assets,stock,environment,identity});
 add('business-authorisation','businessId',prerequisites.rules.find(r=>r.id==='business-eligibility')?.status==='passed');
 add('title-required','name',Boolean(product.name?.trim()));
 add('description-required','description',Boolean(product.description?.trim()));
 add('category-invalid','classification',Boolean(submissions.categoryReference(product.classification)));
 const definition=fields.definition(product.classification?.categoryId);
 for(const field of definition?.fields||[]){const value=product.categoryAttributes?.byCategory?.[definition.categoryId]?.[field.key];add('category-attribute','categoryAttributes.'+field.key,(!field.required&&!value)||typeof value==='string'&&Boolean(value.trim())&&value.length<=field.maxLength);}
 add('price-invalid','price',prerequisites.rules.find(r=>r.id==='pricing')?.status==='passed');
 add('availability-invalid','availability',prerequisites.rules.find(r=>r.id==='stock-availability')?.status==='passed');
 const variants=[...(product.variants||[]),...(product.presentation?.variants||[])];
 const seenSku=new Set(),seenIds=new Set();
 add('variant-invalid','variants',variants.every(v=>{const sku=normalize(v.sku),valid=typeof v.variantId==='string'&&!seenIds.has(v.variantId)&&['contact','available','limited','unavailable'].includes(v.availability||'contact')&&(!sku||!seenSku.has(sku))&&(!v.price||/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(v.price))&&(!v.pricing||Boolean(require('../../js/customer-item-contract').pricing(v.pricing)));seenIds.add(v.variantId);if(sku)seenSku.add(sku);return valid;}));
 const classification=classify(product);
 if(classification.outcome==='conflicting-information')add('category-conflict','classification',false,'warning');
 if(['insufficient-information','unsupported'].includes(classification.outcome))add(classification.basis==='classification-limit'?'classification-limit':'classification-insufficient','classification',false,'info');
 const possibleDuplicates=duplicates(product,profile.products,profile.businessId);
 if(possibleDuplicates.length)add('possible-duplicate','name',false,'warning');
 findings.push(...mediaAnalysis(product,assets,profile.businessId));
 // Technical integrity uses the existing strict storage/derivative relationship rules.
 add('media-integrity','mediaGallery',prerequisites.media.passed);
 const complete=!findings.some(f=>f.severity==='error'&&f.status!=='passed');
 const lifecycle=product.submission?.state||'draft';
 // Approved is reported only with current genuine evidence. Assistance cannot approve.
 const checked=product.submission?.validation;
 const verifiedApproval=prerequisites.rules.every(r=>r.status==='passed')&&['approved','published'].includes(lifecycle)&&checked?.state==='approved'&&checked.contentHash===submissions.contentHash(product)&&checked.mediaFingerprint===prerequisites.media.fingerprint&&submissions.MANDATORY.every(id=>checked.rules?.some(r=>r.id===id&&r.status==='passed'&&(r.code==='not-applicable'||r.independentlyVerified===true||r.authorityDecisionId&&Date.parse(r.expiresAt)>Date.now())));
 const readiness=lifecycle==='rejected'?'rejected':lifecycle==='validating'?'submitted':lifecycle==='review-required'||['approved','published'].includes(lifecycle)&&!verifiedApproval?'held':verifiedApproval?'approved':complete?'ready-for-vendor-review':'incomplete-draft';
 return {schemaVersion:1,rulesVersion:VERSION,registryVersion:registry.DATASET_VERSION,fieldSchemaVersion:fields.VERSION,businessId:profile.businessId,productId:product.productId,productRevision:require('./vendor-inventory').catalogueRevision(product),contextRevision:require('./vendor-inventory').catalogueRevision(profile),stockRevision:stock.revision,inputHash:fingerprint({profile,product,assets,stock}),analyzedAt:now,validUntil:new Date(Math.min(Date.parse(now)+86400000,...(product.submission?.validation?.rules||[]).map(r=>Date.parse(r.expiresAt)).filter(Number.isFinite))).toISOString(),classification,findings,possibleDuplicates,readiness,lifecycle,publicationPermitted:false,model:{available:false,reason:'no-authorised-model'},review:{status:'unreviewed',actions:[]},metrics:{durationMs:Number((performance.now()-started).toFixed(3)),productsExamined:profile.products.length,mediaExamined:Math.min(assets.length,LIMITS.media)}};
}
module.exports={VERSION,LIMITS,hash,normalize,classify,duplicates,mediaAnalysis,fingerprint,analyze};
