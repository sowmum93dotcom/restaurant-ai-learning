'use strict';
const {structuredIntention,validateUnderstandingOutput,SCHEMA_VERSION}=require('./customer-search-intention');
const {plain,id}=require('./customer-evidence-provenance');
async function deadline(operation,ms=150){
  const duration=Number.isInteger(ms)&&ms>=1&&ms<=250?ms:150;
  const controller=new AbortController();let timer;
  try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('deadline'));},duration);})]);}
  finally{clearTimeout(timer);}
}
function providerText(text){
  // No profile/contact objects are sent. Redact obvious contacts/secrets in free
  // text as well; approval still requires a reviewed provider data policy.
  return String(text).replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'[redacted]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[redacted]').replace(/\b(?:\d[ -]?){7,19}\b/g,'[redacted]').replace(/\b(?:token|password|secret|api[_-]?key|authorization)\s*[:=]\s*\S+/gi,'[redacted]');
}
async function understandSearch({understanding,place='',locale='en',configuration}={}){
  const baseline=structuredIntention(understanding,place,locale);
  const c=configuration?.understanding;
  if(!c||c.mode!=='approved'||!id(c.version)||c.provider?.intelligenceVersion!==c.version||c.allowProviderRequest!==true||typeof c.provider?.understand!=='function')return {intention:baseline,reason:'baseline_understanding'};
  try{
    const approval=await deadline(()=>typeof c.resolveApproval==='function'?c.resolveApproval(c.version):null,c.timeoutMs);
    if(!plain(approval)||approval.approved!==true||approval.purpose!=='query-understanding'||approval.candidateVersion!==c.version||approval.rollbackVersion!==SCHEMA_VERSION||!id(approval.decisionId)||!/^[a-f0-9]{64}$/.test(approval.artifactFingerprint || '')||c.provider.artifactFingerprint!==approval.artifactFingerprint)return {intention:baseline,reason:'understanding_approval_required'};
    const text=providerText(understanding.customerText);
    // Redaction changes offsets; keep baseline rather than map unsafe spans.
    if(text!==understanding.customerText)return {intention:baseline,reason:'private_query_baseline'};
    const raw=await deadline(signal=>c.provider.understand(Object.freeze({schemaVersion:1,text,locale:baseline.locale,dataOnly:true,signal})),c.timeoutMs);
    const validated=validateUnderstandingOutput(raw,text,baseline);
    return validated?{intention:validated,reason:'validated_understanding'}:{intention:baseline,reason:'invalid_understanding_response'};
  }catch(_error){return {intention:baseline,reason:'understanding_fallback'};}
}
module.exports={deadline,providerText,understandSearch};
