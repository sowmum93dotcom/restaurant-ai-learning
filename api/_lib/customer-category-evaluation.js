'use strict';
const {DATASET_VERSION,getCategory}=require('./marketing-agent-categories');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const {MAX_CATEGORIES}=require('./customer-category-classification');
const {VERSION,CASES}=require('./customer-category-eval-set');
function validIds(ids){return Array.isArray(ids)&&ids.length<=MAX_CATEGORIES&&ids.every(x=>getCategory(x))&&new Set(ids).size===ids.length;}
function same(a,b){return a.length===b.length&&a.every(x=>b.includes(x));}
async function evaluateCategoryUnderstanding({evaluate,cases=CASES,independentReview=null}={}){
  if(typeof evaluate!=='function'||!Array.isArray(cases)||!cases.length||cases.length>1000)throw new Error('Invalid category evaluation input');
  const seen=new Set();
  for(const row of cases){
    if(!row||!id(row.caseId)||seen.has(row.caseId)||!LOCALES.includes(row.locale)||typeof row.text!=='string'||!row.text.trim()||row.text.length>10000||!validIds(row.expectedCategoryIds)||typeof row.allowFallback!=='boolean'||typeof row.positiveUnsafe!=='boolean'||typeof row.responseScenario!=='string')throw new Error('Invalid category evaluation case');
    seen.add(row.caseId);
  }
  // Stable content fingerprint binds independent judgement to these exact cases.
  const datasetFingerprint=fingerprint(cases);
  const rows=[];
  for(const row of cases){
    let output;
    try{output=await evaluate(Object.freeze({...row,expectedCategoryIds:Object.freeze([...row.expectedCategoryIds])}));}catch(_error){output=null;}
    let status;
    try{
      const result=output?.interpretation;
      if(!result||result.datasetVersion!==DATASET_VERSION||!validIds(result.categoryIds))status='unsafe-classification';
      else if(result.categoryIds.length&&row.positiveUnsafe)status='unsafe-classification';
      else if(same(result.categoryIds,row.expectedCategoryIds))status='correct-classification';
      else if(!result.categoryIds.length&&row.allowFallback)status='safe-fallback';
      else status='incorrect-classification';
    }catch(_error){status='unsafe-classification';}
    rows.push({caseId:row.caseId,locale:row.locale,status});
  }
  const counts=Object.fromEntries(['correct-classification','safe-fallback','incorrect-classification','unsafe-classification'].map(status=>[status,rows.filter(row=>row.status===status).length]));
  const locales=Object.fromEntries(LOCALES.map(locale=>[locale,{cases:rows.filter(row=>row.locale===locale).length,correct:rows.filter(row=>row.locale===locale&&row.status==='correct-classification').length}]));
  const independentlyReviewed=!!(cases.every(row=>row.judgement==='independently-judged')&&independentReview?.approved===true&&independentReview.datasetFingerprint===datasetFingerprint&&independentReview.datasetVersion===VERSION&&id(independentReview.decisionId)!==null&&Array.isArray(independentReview.locales)&&independentReview.locales.length===LOCALES.length&&new Set(independentReview.locales).size===LOCALES.length&&LOCALES.every(locale=>independentReview.locales.includes(locale)));
  // A boolean report is not artifact approval or production promotion. In this
  // initial gate, fallback-only or partially covered candidates cannot pass.
  const releaseGatePassed=independentlyReviewed&&LOCALES.every(locale=>locales[locale].cases>0)&&counts['unsafe-classification']===0&&counts['incorrect-classification']===0&&counts['safe-fallback']===0;
  return {schemaVersion:1,datasetVersion:VERSION,categoryDatasetVersion:DATASET_VERSION,datasetFingerprint,counts,locales,rows,independentlyReviewed,releaseGatePassed};
}
module.exports={evaluateCategoryUnderstanding};
