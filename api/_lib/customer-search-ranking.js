'use strict';
const {rankOfflineFeatures}=require('./customer-offline-ranker');
const {plain}=require('./customer-evidence-provenance');
const {providerText}=require('./customer-search-understanding');
function publicRankingEvidence(possibility){
  return {schemaVersion:1,content:providerText(possibility.content).slice(0,500),
    ...(possibility.location?{location:providerText(possibility.location).slice(0,80)}:{}),
    products:(possibility.products || []).slice(0,10).map(p=>({productId:p.productId,name:providerText(p.name).slice(0,120),description:providerText(p.description).slice(0,500),availability:p.availability,
      ...(p.presentation?.pricing?{pricing:{...p.presentation.pricing}}:{})}))};
}
function validateRankingEvidence(e){
  if(!plain(e)||e.schemaVersion!==1||Object.keys(e).some(k=>!['schemaVersion','content','location','products'].includes(k))||typeof e.content!=='string'||e.content.length>500||(e.location!==undefined&&(typeof e.location!=='string'||e.location.length>80))||!Array.isArray(e.products)||e.products.length>10)return null;
  for(const p of e.products){
    if(!plain(p)||Object.keys(p).some(k=>!['productId','name','description','availability','pricing'].includes(k))||typeof p.productId!=='string'||!p.productId.length||p.productId.length>128||typeof p.name!=='string'||p.name.length>120||typeof p.description!=='string'||p.description.length>500||!['available','limited','unavailable','contact'].includes(p.availability))return null;
    if(p.pricing && (!plain(p.pricing)||Object.keys(p.pricing).some(k=>!['mode','currency','amount','min','max'].includes(k))||!require('../../js/customer-item-contract').pricing(p.pricing)))return null;
  }
  return JSON.parse(JSON.stringify(e));
}
function rankingCandidates(possibilities){return possibilities.map(p=>({possibilityId:p.possibilityId,workItemId:p.workItemId,rankingEvidence:publicRankingEvidence(p)}));}
// Public, versioned feature mapping; no customer preferences/profile/history.
const FEATURE_POLICY='public-relevance-features-v1';
function featureRows(possibilities){return possibilities.map(p=>({resultId:p.possibilityId,values:{exact_match:Math.min((p.relevance?.evidence || []).length,5)/5,concept_match:p.relevance?.basis==='current-intention-authorized-work'?1:0,preference_match:0}}));}
function offlineShadowProvider(artifact,possibilities,baselineVersion){
  if(artifact?.baseIntelligenceVersion!==baselineVersion || !rankOfflineFeatures(artifact,featureRows(possibilities)))return null;
  return {intelligenceVersion:artifact.candidateVersion,artifactFingerprint:artifact.fingerprint,rank:async input=>{
    if(input.candidates.length!==possibilities.length||input.candidates.some(c=>!possibilities.some(p=>p.possibilityId===c.possibilityId)))throw new Error('eligible_set_mismatch');
    return {ranked:rankOfflineFeatures(artifact,featureRows(possibilities)).map(r=>({possibilityId:r.resultId,score:r.score}))};
  }};
}
module.exports={FEATURE_POLICY,publicRankingEvidence,validateRankingEvidence,rankingCandidates,featureRows,offlineShadowProvider};
