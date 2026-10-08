'use strict';
const {evaluateCategoryUnderstanding}=require('./customer-category-evaluation');
const {evaluateCustomerCategories}=require('./customer-category-understanding');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const {CASES}=require('./customer-category-eval-set');
// Offline runner. No expected label/scenario is passed to the provider. The
// existing immutable evaluation harness owns judgement and release comparison.
async function evaluateCategoryProvider({categoryUnderstanding,cases=CASES.filter(row=>row.responseScenario==='normal'),independentReview}={}){
 const providerVersion=id(categoryUnderstanding?.provider?.intelligenceVersion)||null;
 const artifactFingerprint=/^[a-f0-9]{64}$/.test(categoryUnderstanding?.provider?.artifactFingerprint||'')?categoryUnderstanding.provider.artifactFingerprint:null;
 const executions=new Map();
 const report=await evaluateCategoryUnderstanding({cases,independentReview,evaluate:async row=>{
  const result=await evaluateCustomerCategories({text:row.text,locale:row.locale,configuration:{categoryUnderstanding}});
  const providerEvaluated=result.reason==='validated_category_understanding';
  executions.set(row.caseId,{providerEvaluated,reason:result.reason});
  // Pipeline metrics retain the actual baseline. Provider-only metrics below
  // never give a fallback credit for semantic quality or release approval.
  return result;
 }});
 const total=report.rows.length;
 const providerRows=report.rows.filter(row=>executions.get(row.caseId).providerEvaluated);
 const failures=report.rows.filter(row=>!executions.get(row.caseId).providerEvaluated&&executions.get(row.caseId).reason!=='category_negation_baseline');
 const baselineRows=report.rows.filter(row=>!executions.get(row.caseId).providerEvaluated);
 const metrics={pipelineAccuracy:report.counts['correct-classification']/total,baselineAccuracy:baselineRows.length?baselineRows.filter(row=>row.status==='correct-classification').length/baselineRows.length:null,providerAccuracy:providerRows.length?providerRows.filter(row=>row.status==='correct-classification').length/providerRows.length:null,providerCoverage:providerRows.length/total,unsafeClassificationRate:report.counts['unsafe-classification']/total,providerRejectedOrUnavailableCases:failures.length,baselineCases:baselineRows.length};
 const localeMetrics=Object.fromEntries(LOCALES.map(locale=>{
  const rows=report.rows.filter(row=>row.locale===locale),evaluated=providerRows.filter(row=>row.locale===locale);
  return [locale,{cases:rows.length,providerCases:evaluated.length,providerAccuracy:evaluated.length?evaluated.filter(row=>row.status==='correct-classification').length/evaluated.length:null,unsafeClassificationRate:rows.length?rows.filter(row=>row.status==='unsafe-classification').length/rows.length:null}];
 }));
 const rows=report.rows.map(row=>({...row,executionOrigin:executions.get(row.caseId).providerEvaluated?'provider':'baseline',executionReason:executions.get(row.caseId).reason}));
 const result={...report,rows,providerVersion,artifactFingerprint,metrics,localeMetrics,releaseGatePassed:report.releaseGatePassed&&!!providerVersion&&!!artifactFingerprint&&failures.length===0&&LOCALES.every(locale=>localeMetrics[locale].providerCases>0)};
 return {...result,reportFingerprint:fingerprint(result)};
}
module.exports={evaluateCategoryProvider};
