'use strict';
const {evaluateCategoryProvider}=require('./customer-category-provider-evaluation');
const {LOCALES,id,fingerprint}=require('./customer-evidence-provenance');
const DIMENSIONS=Object.freeze(['canonical','paraphrase','ambiguity','multiple-categories','negation','exclusion','incorrect-classification','unsafe-response']);
function snapshotData(value,maxBytes){
 let nodes=0;
 function copy(x,depth){
  if(++nodes>30000||depth>12)throw new Error('invalid_reviewed_data');
  if(x===null||typeof x==='boolean')return x;
  if(typeof x==='string'){if(x.length>10000)throw new Error('invalid_reviewed_data');return x;}
  if(typeof x==='number'&&Number.isFinite(x))return x;
  const array=Array.isArray(x);
  if(!x||Object.getPrototypeOf(x)!==(array?Array.prototype:Object.prototype))throw new Error('invalid_reviewed_data');
  const keys=Reflect.ownKeys(x);
  if(array&&(x.length>8000||keys.length!==x.length+1))throw new Error('invalid_reviewed_data');
  const out=array?[]:{};
  for(const key of keys){
   if(array&&key==='length')continue;
   if(typeof key!=='string'||key==='__proto__'||(array&&!/^(0|[1-9][0-9]*)$/.test(key)))throw new Error('invalid_reviewed_data');
   const d=Object.getOwnPropertyDescriptor(x,key);if(!d||!Object.hasOwn(d,'value'))throw new Error('invalid_reviewed_data');
   out[key]=copy(d.value,depth+1);
  }
  return out;
 }
 const result=copy(value,0);if(JSON.stringify(result).length>maxBytes)throw new Error('invalid_reviewed_data');return result;
}
// Offline-only. The authenticated read-only evaluation service, not a provider
// or customer, supplies independently reviewed labels and real-run permission.
async function evaluateReviewedCategoryProvider({datasetId,readEvaluation,categoryUnderstanding}={}){
 if(!id(datasetId)||typeof readEvaluation!=='function')throw new Error('reviewed_evaluation_service_required');
 const received=await readEvaluation(Object.freeze({datasetId,purpose:'category-understanding'}));
 const data=snapshotData(received,1000000);
 if(Object.keys(data).sort().join(',')!=='cases,coverage,datasetId,independentReview,reviewDecisionId,schemaVersion'||data.schemaVersion!==1||data.datasetId!==datasetId||!id(data.reviewDecisionId)||data.independentReview?.decisionId!==data.reviewDecisionId||!Array.isArray(data.coverage)||data.coverage.length>8000)throw new Error('invalid_reviewed_evaluation');
 const report=await evaluateCategoryProvider({categoryUnderstanding,cases:data.cases,independentReview:data.independentReview});
 const seen=new Set();
 for(const row of data.coverage){
  if(!row||Object.keys(row).sort().join(',')!=='caseId,dimension'||!DIMENSIONS.includes(row.dimension)||!report.rows.some(x=>x.caseId===row.caseId)||seen.has(row.caseId+':'+row.dimension))throw new Error('invalid_evaluation_coverage');
  seen.add(row.caseId+':'+row.dimension);
 }
 const coverage=Object.fromEntries(LOCALES.map(locale=>[locale,Object.fromEntries(DIMENSIONS.map(dimension=>[dimension,data.coverage.filter(c=>c.dimension===dimension&&report.rows.some(row=>row.caseId===c.caseId&&row.locale===locale)).length]))]));
 const complete=LOCALES.every(locale=>DIMENSIONS.every(dimension=>coverage[locale][dimension]>0));
 const result={...report,reviewDecisionId:data.reviewDecisionId,evaluationCoverage:coverage,releaseGatePassed:report.releaseGatePassed&&complete};delete result.reportFingerprint;
 return {...result,reportFingerprint:fingerprint(result)};
}
module.exports={DIMENSIONS,snapshotData,evaluateReviewedCategoryProvider};
