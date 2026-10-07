'use strict';
// Advisory understanding only. No provider, approval or writer is installed here.
const {DATASET_VERSION,CATEGORIES,validateReference}=require('./marketing-agent-categories');
const {MAX_CATEGORIES,interpretCategories}=require('./customer-category-classification');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const {deadline,providerText}=require('./customer-search-understanding');
const SCHEMA_VERSION='customer-category-understanding-v1';
const BASELINE_VERSION='customer-category-literal-v1';
const PURPOSE='category-understanding';
const REGISTRY=Object.freeze(CATEGORIES.map(({categoryId,sectorId,categoryName})=>Object.freeze({categoryId,sectorId,categoryName})));
function keys(value,expected){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)return false;
  const own=Reflect.ownKeys(value);
  return own.length===expected.length&&own.every(key=>typeof key==='string'&&expected.includes(key)&&Object.getOwnPropertyDescriptor(value,key)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
function hasNegation(text){
  // Conservative protection: any explicit English negative clause keeps the
  // literal baseline. This cannot resolve general/multilingual semantics.
  return text.normalize('NFKC').toLowerCase().split(/[;.!?\n,]/u).some(clause=>{
    const words=clause.match(/[\p{L}\p{N}]+/gu)||[];
    return words.some((word,index)=>['no','not','without','avoid','exclude','excluding','except'].includes(word)&&!(word==='not'&&words[index+1]==='only'));
  })||/\b(?:don['’]t|isn['’]t|aren['’]t|won['’]t|never)\b/iu.test(text);
}
function validateSemanticCandidates(value,text){
  try{
    if(typeof text!=='string'||!text.trim()||text.length>10000||!keys(value,['schemaVersion','datasetVersion','candidates'])||value.schemaVersion!==SCHEMA_VERSION||value.datasetVersion!==DATASET_VERSION||!Array.isArray(value.candidates)||value.candidates.length>MAX_CATEGORIES||hasNegation(text))return null;
    const seen=new Set(),candidates=[];
    for(const row of value.candidates){
      if(!keys(row,['categoryId','sectorId','confidence','evidence'])||!keys(row.evidence,['start','end']))return null;
      const reference=validateReference({categoryId:row.categoryId,sectorId:row.sectorId});
      const {start,end}=row.evidence;
      if(!reference||seen.has(row.categoryId)||!Number.isFinite(row.confidence)||row.confidence<0||row.confidence>1||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>text.length||!text.slice(start,end).trim())return null;
      seen.add(row.categoryId);
      candidates.push(Object.freeze({...reference,confidence:row.confidence,evidence:Object.freeze({start,end})}));
    }
    return Object.freeze(candidates);
  }catch(_error){return null;}
}
function fallback(text,scope,reason){return {interpretation:scope==='customer-request'?interpretCategories(text):{datasetVersion:DATASET_VERSION,categoryIds:[],source:'baseline-fallback'},reason};}
async function understandCategoryText({text,locale='en',scope='customer-request',sourceReference=null,configuration}={}){
  const baseline=reason=>fallback(text,scope,reason);
  const c=configuration?.categoryUnderstanding;
  try{
    if(!['customer-request','published-offer'].includes(scope)||typeof text!=='string'||!text.trim()||text.length>(scope==='customer-request'?500:10000)||!LOCALES.includes(locale))return baseline('invalid_category_input');
    if(!c||c.mode!=='approved'||c.allowProviderRequest!==true||!id(c.version)||c.provider?.intelligenceVersion!==c.version||typeof c.provider?.classify!=='function'||typeof c.resolveApproval!=='function'||typeof c.authorizeData!=='function'||typeof c.resolveValidation!=='function')return baseline('baseline_category_understanding');
    // Existing redaction guard plus a reviewed, source-bound data-policy hook.
    // No redacted text is submitted: offsets and meaning must stay reproducible.
    if(providerText(text)!==text)return baseline('private_category_input');
    if(hasNegation(text))return baseline('category_negation_baseline');
    const requestFingerprint=fingerprint({schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,text,locale,scope,sourceReference});
    // One total deadline for approval, privacy, provider and validation, rather
    // than four sequential provider deadlines in the customer request path.
    return await deadline(async signal=>{
      const approval=await c.resolveApproval(c.version,{scope,locale,signal});
      if(signal.aborted)return baseline('category_deadline');
      if(!keys(approval,['approved','purpose','candidateVersion','artifactFingerprint','rollbackVersion','decisionId','locale'])||approval.approved!==true||approval.purpose!==PURPOSE||approval.candidateVersion!==c.version||approval.rollbackVersion!==BASELINE_VERSION||approval.locale!==locale||!id(approval.decisionId)||!/^[a-f0-9]{64}$/.test(approval.artifactFingerprint||'')||c.provider.artifactFingerprint!==approval.artifactFingerprint)return baseline('category_approval_required');
      const policy=await c.authorizeData(Object.freeze({purpose:PURPOSE,scope,locale,text,sourceReference,requestFingerprint,signal}));
      if(signal.aborted)return baseline('category_deadline');
      if(!keys(policy,['allowed','purpose','requestFingerprint','policyVersion'])||policy.allowed!==true||policy.purpose!==PURPOSE||policy.requestFingerprint!==requestFingerprint||!id(policy.policyVersion))return baseline('category_policy_required');
      const raw=await c.provider.classify(Object.freeze({schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,scope,locale,text,categories:REGISTRY,dataOnly:true,signal}));
      if(signal.aborted)return baseline('category_deadline');
      const candidates=validateSemanticCandidates(raw,text);
      if(!candidates||!candidates.length)return baseline('invalid_or_empty_category_response');
      // Explicit canonical category evidence is already deterministic. An
      // advisory must not discard it in favour of a different known category.
      const literal=interpretCategories(text);
      if(literal.categoryIds.some(categoryId=>!candidates.some(row=>row.categoryId===categoryId)))return baseline('explicit_category_preserved');
      // A span proves where text came from, not what it means. Require a separate
      // DEMEOS validation decision, bound to this exact source and candidate set.
      const candidateFingerprint=fingerprint(candidates);
      const decision=await c.resolveValidation(Object.freeze({purpose:PURPOSE,scope,locale,text,sourceReference,requestFingerprint,candidateFingerprint,candidates,signal}));
      if(signal.aborted)return baseline('category_deadline');
      if(!keys(decision,['approved','purpose','decisionId','requestFingerprint','candidateFingerprint','datasetVersion','locale','scope','constraintsPreserved','exclusionsPreserved'])||decision.approved!==true||decision.purpose!==PURPOSE||!id(decision.decisionId)||decision.requestFingerprint!==requestFingerprint||decision.candidateFingerprint!==candidateFingerprint||decision.datasetVersion!==DATASET_VERSION||decision.locale!==locale||decision.scope!==scope||decision.constraintsPreserved!==true||decision.exclusionsPreserved!==true)return baseline('category_validation_required');
      return {interpretation:{datasetVersion:DATASET_VERSION,categoryIds:candidates.map(row=>row.categoryId),source:'validated-semantic-advisory'},reason:'validated_category_understanding',validation:{decisionId:decision.decisionId,requestFingerprint,candidateFingerprint}};
    },c.timeoutMs);
  }catch(_error){return baseline('category_understanding_fallback');}
}
async function understandCustomerCategories({text,locale,configuration}={}){
  return understandCategoryText({text,locale,configuration,scope:'customer-request'});
}
async function suggestPublishedOfferCategories({work,workItemId,productId,locale='en',configuration,testMode=false}={}){
  // Call only with the existing approved repository catalogue. Publication
  // provenance must ALSO be authorized by the internal data-policy service.
  // No business slogan, another offer, profile or continuation data is sent.
  if(testMode)return fallback('', 'published-offer','controlled_content_disabled');
  const {getValidPublicCustomerWork}=require('./customer-public-work-contract');
  const item=getValidPublicCustomerWork(work).find(row=>row.workItemId===workItemId);
  const product=item?.products?.find(row=>row.productId===productId);
  if(!product)return fallback('','published-offer','published_offer_missing');
  return understandCategoryText({text:product.name+' '+product.description,locale,scope:'published-offer',sourceReference:Object.freeze({workItemId:item.workItemId,productId:product.productId}),configuration});
}
module.exports={SCHEMA_VERSION,BASELINE_VERSION,PURPOSE,validateSemanticCandidates,understandCustomerCategories,suggestPublishedOfferCategories};
