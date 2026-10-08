'use strict';
const {evaluateCategoryUnderstanding}=require('./customer-category-evaluation');
const {understandCustomerCategories}=require('./customer-category-understanding');
const {DATASET_VERSION}=require('./marketing-agent-categories');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
// Offline runner. No expected label/scenario is passed to the provider. The
// existing immutable evaluation harness owns judgement and release comparison.
async function evaluateCategoryProvider({categoryUnderstanding,cases,independentReview}={}){
 const providerVersion=id(categoryUnderstanding?.provider?.intelligenceVersion)||null;
 const artifactFingerprint=/^[a-f0-9]{64}$/.test(categoryUnderstanding?.provider?.artifactFingerprint||'')?categoryUnderstanding.provider.artifactFingerprint:null;
 const executions=new Map();
 const report=await evaluateCategoryUnderstanding({cases,independentReview,evaluate:async row=>{
  const result=await understandCustomerCategories({text:row.text,locale:row.locale,configuration:{categoryUnderstanding}});
  const providerEvaluated=result.reason==='validated_category_understanding';
  executions.set(row.caseId,{providerEvaluated,reason:result.reason});
  // Literal baseline success must never masquerade as semantic provider quality.
  return providerEvaluated?result:{interpretation:{datasetVersion:DATASET_VERSION,categoryIds:[]}};
 }});
 const total=report.rows.length;
 const providerRows=report.rows.filter(row=>executions.get(row.caseId).providerEvaluated);
 const failures=report.rows.filter(row=>!executions.get(row.caseId).providerEvaluated&&executions.get(row.caseId).reason!=='category_negation_baseline');
 const metrics={pipelineAccuracy:report.counts['correct-classification']/total,providerAccuracy:providerRows.length?providerRows.filter(row=>row.status==='correct-classification').length/providerRows.length:null,providerCoverage:providerRows.length/total,unsafeClassificationRate:report.counts['unsafe-classification']/total,providerRejectedOrUnavailableCases:failures.length,baselineCases:total-providerRows.length};
 const localeMetrics=Object.fromEntries(LOCALES.map(locale=>{
  const rows=report.rows.filter(row=>row.locale===locale),evaluated=providerRows.filter(row=>row.locale===locale);
  return [locale,{cases:rows.length,providerCases:evaluated.length,providerAccuracy:evaluated.length?evaluated.filter(row=>row.status==='correct-classification').length/evaluated.length:null,unsafeClassificationRate:rows.length?rows.filter(row=>row.status==='unsafe-classification').length/rows.length:null}];
 }));
 const result={...report,providerVersion,artifactFingerprint,metrics,localeMetrics,releaseGatePassed:report.releaseGatePassed&&!!providerVersion&&!!artifactFingerprint&&failures.length===0&&LOCALES.every(locale=>localeMetrics[locale].providerCases>0)};
 return {...result,reportFingerprint:fingerprint(result)};
}
module.exports={evaluateCategoryProvider};
