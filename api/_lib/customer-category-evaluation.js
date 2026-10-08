'use strict';
const {DATASET_VERSION,validateCategoryIds}=require('./marketing-agent-categories');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const {MAX_CATEGORIES}=require('./customer-category-classification');
const {VERSION,CASES}=require('./customer-category-eval-set');
function dataRecord(value,fields){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==fields.length)return null;
  const copy={};
  for(const field of fields){
    const descriptor=Object.getOwnPropertyDescriptor(value,field);
    if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;
    copy[field]=descriptor.value;
  }
  return copy;
}
function snapshotCases(cases){
  if(!Array.isArray(cases)||!Number.isInteger(cases.length)||!cases.length||cases.length>1000)throw new Error('Invalid category evaluation input');
  const length=cases.length,seen=new Set(),snapshot=[];
  for(let index=0;index<length;index++){
    const descriptor=Object.getOwnPropertyDescriptor(cases,String(index));
    const row=descriptor&&Object.hasOwn(descriptor,'value')?dataRecord(descriptor.value,['caseId','locale','text','expectedCategoryIds','allowFallback','positiveUnsafe','responseScenario','judgement']):null;
    const expectedCategoryIds=row?validateCategoryIds(row.expectedCategoryIds,MAX_CATEGORIES):null;
    if(!row||!id(row.caseId)||seen.has(row.caseId)||!LOCALES.includes(row.locale)||typeof row.text!=='string'||!row.text.trim()||row.text.length>10000||!expectedCategoryIds||typeof row.allowFallback!=='boolean'||typeof row.positiveUnsafe!=='boolean'||!id(row.responseScenario)||!['specification-only','independently-judged'].includes(row.judgement))throw new Error('Invalid category evaluation case');
    seen.add(row.caseId);snapshot.push(Object.freeze({...row,expectedCategoryIds}));
  }
  return Object.freeze(snapshot);
}
function hasIndependentReview(value,datasetFingerprint){
  try{
    const review=dataRecord(value,['approved','datasetFingerprint','datasetVersion','decisionId','locales']);
    if(!review||review.approved!==true||review.datasetFingerprint!==datasetFingerprint||review.datasetVersion!==VERSION||!id(review.decisionId)||!Array.isArray(review.locales)||review.locales.length!==LOCALES.length)return false;
    const seen=new Set();
    for(let index=0;index<LOCALES.length;index++){
      const descriptor=Object.getOwnPropertyDescriptor(review.locales,String(index));
      if(!descriptor||!Object.hasOwn(descriptor,'value')||!LOCALES.includes(descriptor.value)||seen.has(descriptor.value))return false;
      seen.add(descriptor.value);
    }
    return true;
  }catch(_error){return false;}
}
function same(a,b){
  if(a.length!==b.length)return false;
  for(let index=0;index<a.length;index++){
    let matched=false;
    for(let other=0;other<b.length;other++)if(a[index]===b[other])matched=true;
    if(!matched)return false;
  }
  return true;
}
async function evaluateCategoryUnderstanding({evaluate,cases=CASES,independentReview=null}={}){
  if(typeof evaluate!=='function')throw new Error('Invalid category evaluation input');
  const snapshot=snapshotCases(cases);
  // Stable content fingerprint binds independent judgement to these exact cases.
  const datasetFingerprint=fingerprint(snapshot);
  // Capture review authority before any evaluator can mutate caller-owned data.
  const independentlyReviewed=snapshot.every(row=>row.judgement==='independently-judged')&&hasIndependentReview(independentReview,datasetFingerprint);
  const rows=[];
  for(const row of snapshot){
    let output;
    // Expected labels, judgement and safety policy are never evaluator inputs.
    try{output=await evaluate(Object.freeze({caseId:row.caseId,locale:row.locale,text:row.text,responseScenario:row.responseScenario}));}catch(_error){output=null;}
    let status;
    try{
      const result=output?.interpretation;
      const categoryIds=result?.datasetVersion===DATASET_VERSION?validateCategoryIds(result.categoryIds,MAX_CATEGORIES):null;
      if(!categoryIds)status='unsafe-classification';
      else if(categoryIds.length&&row.positiveUnsafe)status='unsafe-classification';
      else if(same(categoryIds,row.expectedCategoryIds))status='correct-classification';
      else if(!categoryIds.length&&row.allowFallback)status='safe-fallback';
      else status='incorrect-classification';
    }catch(_error){status='unsafe-classification';}
    rows.push({caseId:row.caseId,locale:row.locale,status});
  }
  const counts=Object.fromEntries(['correct-classification','safe-fallback','incorrect-classification','unsafe-classification'].map(status=>[status,rows.filter(row=>row.status===status).length]));
  const locales=Object.fromEntries(LOCALES.map(locale=>[locale,{cases:rows.filter(row=>row.locale===locale).length,correct:rows.filter(row=>row.locale===locale&&row.status==='correct-classification').length}]));
  // A boolean report is not artifact approval or production promotion. In this
  // initial gate, fallback-only or partially covered candidates cannot pass.
  const releaseGatePassed=independentlyReviewed&&LOCALES.every(locale=>locales[locale].cases>0)&&counts['unsafe-classification']===0&&counts['incorrect-classification']===0&&counts['safe-fallback']===0;
  return {schemaVersion:1,datasetVersion:VERSION,categoryDatasetVersion:DATASET_VERSION,datasetFingerprint,counts,locales,rows,independentlyReviewed,releaseGatePassed};
}
module.exports={evaluateCategoryUnderstanding};
