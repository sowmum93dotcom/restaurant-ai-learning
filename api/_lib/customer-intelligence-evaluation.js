'use strict';
const {LOCALES,id,ids,plain,fingerprint}=require('./customer-evidence-provenance');
function validFacts(facts) {
  return plain(facts) && Object.keys(facts).length<=200 && Object.entries(facts).every(([key,values])=>id(key) && plain(values) && Object.keys(values).length<=50 && Object.entries(values).every(([field,value])=>id(field) && (typeof value==='boolean' || (typeof value==='number' && Number.isFinite(value)) || (typeof value==='string' && value.length<=500))));
}
const AREAS=Object.freeze(['relevance','weak-match','misleading','unsupported','no-result','ambiguous','necessary-clarification','unnecessary-clarification','negation','hard-exclusion','must-have','preference','budget','date','time','location','distance','quantity','party-context','paraphrase','noisy-language','multilingual','fact-integrity']);
function evaluateIntelligence({cases,predictions,version,minimumCasesPerLocale=1,cutoff=20}={}) {
  if(!Number.isInteger(cutoff) || cutoff<1 || cutoff>200 || !id(version) || !Array.isArray(cases) || !cases.length || cases.length>10000 || !plain(predictions) || !Number.isInteger(minimumCasesPerLocale) || minimumCasesPerLocale<1)return {valid:false,reason:'invalid_evaluation_input'};
  const totals={precision:0,recall:0,mrr:0,ndcg:0,misleadingMatchRate:0,unsupportedPrecision:0,hardConstraintViolationRate:0,factIntegrity:0,clarificationAccuracy:0};
  const counts=Object.fromEntries(LOCALES.map(x=>[x,0])),areas=Object.fromEntries(AREAS.map(x=>[x,{count:0,passed:true}])),seen=new Set();
  let unsupported=0,unsupportedCorrect=0,answerable=0;
  for(const c of cases) {
    if(!plain(c))return {valid:false,reason:'invalid_judged_case'};
    const expected=ids(c.expectedResultIds),eligible=ids(c.eligibleIds), forbidden=ids(c.forbiddenResultIds || []), p=predictions[c.id];
    if(!id(c.id) || seen.has(c.id) || !LOCALES.includes(c.locale) || !expected || !eligible || !forbidden || expected.some(x=>!eligible.includes(x) || forbidden.includes(x)) || !Array.isArray(c.areas) || !c.areas.length || c.areas.some(x=>!AREAS.includes(x)) || typeof c.clarificationRequired!=='boolean' || !validFacts(c.approvedFacts) || !plain(p))return {valid:false,reason:'invalid_judged_case'};
    seen.add(c.id);counts[c.locale]++;
    const returned=ids(p.resultIds);
    if(!returned || typeof p.clarificationAsked!=='boolean' || !Array.isArray(p.factClaims) || p.factClaims.length>200)return {valid:false,reason:'invalid_prediction'};
    // preserve ranked order after validating uniqueness
    const ranked=p.resultIds.slice(0,cutoff), matches=ranked.filter(x=>expected.includes(x)).length;
    const violations=p.resultIds.filter(x=>!eligible.includes(x) || forbidden.includes(x)).length;
    const factsOK=p.factClaims.every(claim=>plain(claim) && Object.keys(claim).sort().join(',')==='field,resultId,value' && p.resultIds.includes(claim.resultId) && Object.hasOwn(c.approvedFacts,claim.resultId) && plain(c.approvedFacts[claim.resultId]) && Object.hasOwn(c.approvedFacts[claim.resultId],claim.field) && c.approvedFacts[claim.resultId][claim.field]===claim.value);
    const precision=ranked.length?matches/ranked.length:expected.length?0:1,recall=expected.length?matches/expected.length:ranked.length?0:1;
    const first=ranked.findIndex(x=>expected.includes(x));
    const dcg=ranked.reduce((sum,x,i)=>sum+(expected.includes(x)?1/Math.log2(i+2):0),0);
    const ideal=Array.from({length:Math.min(expected.length,cutoff)},(_,i)=>1/Math.log2(i+2)).reduce((a,b)=>a+b,0);
    totals.precision+=precision;totals.recall+=recall;if(expected.length)answerable++;totals.mrr+=first<0?0:1/(first+1);totals.ndcg+=ideal?dcg/ideal:0;
    totals.misleadingMatchRate+=ranked.length?(ranked.length-matches)/ranked.length:0;
    totals.hardConstraintViolationRate+=violations?1:0;totals.factIntegrity+=factsOK?1:0;
    const clarified=p.clarificationAsked===c.clarificationRequired;totals.clarificationAccuracy+=clarified?1:0;
    if(!expected.length){unsupported++;if(!ranked.length)unsupportedCorrect++;}
    for(const area of c.areas){areas[area].count++;areas[area].passed &&= precision===1 && recall===1 && violations===0 && factsOK && clarified;}
  }
  for(const key of Object.keys(totals))totals[key]/=cases.length;
  totals.mrr=totals.mrr*cases.length/(answerable || 1);totals.ndcg=totals.ndcg*cases.length/(answerable || 1);
  totals.unsupportedPrecision=unsupported?unsupportedCorrect/unsupported:0;
  totals.relevance=totals.ndcg;
  const missingLocales=LOCALES.filter(x=>counts[x]<minimumCasesPerLocale),missingAreas=AREAS.filter(x=>!areas[x].count);
  return {valid:true,schemaVersion:1,version,caseFingerprint:fingerprint(cases),predictionFingerprint:fingerprint(predictions),caseCount:cases.length,cutoff,answerableCount:answerable,metrics:totals,localeCoverage:counts,
    suites:areas,complete:!missingLocales.length&&!missingAreas.length,missingLocales,missingAreas,
    safe:totals.hardConstraintViolationRate===0&&totals.factIntegrity===1,productionDeploymentAllowed:false};
}
module.exports={AREAS,evaluateIntelligence};
