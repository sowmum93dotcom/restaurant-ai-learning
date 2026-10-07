'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CASES,VERSION}=require('../api/_lib/customer-category-eval-set');
const {evaluateCategoryUnderstanding}=require('../api/_lib/customer-category-evaluation');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {LOCALES,fingerprint}=require('../api/_lib/customer-evidence-provenance');
const answer=ids=>({interpretation:{datasetVersion:DATASET_VERSION,categoryIds:ids}});
const oracle=row=>answer(row.expectedCategoryIds); // Specification oracle, not AI.
test('evaluation data covers nine actual locales and remains explicitly not independently judged',async()=>{
 assert.equal(CASES.length,27);assert.deepEqual([...new Set(CASES.map(x=>x.locale))].sort(),[...LOCALES].sort());assert.ok(CASES.every(row=>row.judgement==='specification-only'));
 const result=await evaluateCategoryUnderstanding({evaluate:oracle});assert.equal(result.counts['correct-classification'],27);assert.equal(result.releaseGatePassed,false);assert.equal(result.independentlyReviewed,false);
 assert.equal((await evaluateCategoryUnderstanding({evaluate:oracle})).datasetFingerprint,result.datasetFingerprint);
});
test('evaluation distinguishes correct, safe fallback, incorrect and unsafe classifications',async()=>{
 const cases=CASES.slice(0,4);
 const result=await evaluateCategoryUnderstanding({cases,evaluate:row=>row.caseId==='canonical'?answer(['89']):row.caseId==='canonical-fashion'?answer([]):row.caseId==='wedding-paraphrase'?answer(['93']):answer(['999'])});
 assert.deepEqual(result.counts,{'correct-classification':1,'safe-fallback':1,'incorrect-classification':1,'unsafe-classification':1});assert.equal(result.releaseGatePassed,false);
 const negative=await evaluateCategoryUnderstanding({cases:CASES.filter(row=>row.positiveUnsafe),evaluate:()=>answer(['89'])});assert.equal(negative.counts['unsafe-classification'],negative.rows.length);
});
test('invalid outputs, thrown execution and invented IDs cannot pass release gate',async()=>{
 for(const evaluate of [()=>null,()=>{throw new Error('failure');},()=>answer(['89','89']),()=>answer(['172']),()=>({interpretation:{datasetVersion:'wrong',categoryIds:['89']}})]){
  const result=await evaluateCategoryUnderstanding({evaluate});assert.equal(result.releaseGatePassed,false);assert.ok(result.counts['unsafe-classification']>0);
 }
});
test('independent gate binds reviewed cases and all locales; synthetic or fallback-only success cannot pass',async()=>{
 const cases=CASES.map(row=>({...row,judgement:'independently-judged'}));
 const independentReview={approved:true,datasetVersion:VERSION,datasetFingerprint:fingerprint(cases),decisionId:'controlled-independent-fixture',locales:[...LOCALES]};
 assert.equal((await evaluateCategoryUnderstanding({cases,evaluate:oracle,independentReview})).releaseGatePassed,true);
 assert.equal((await evaluateCategoryUnderstanding({evaluate:oracle,independentReview:{...independentReview,datasetFingerprint:fingerprint(CASES)}})).releaseGatePassed,false);
 for(const patch of [{datasetFingerprint:'wrong'},{datasetVersion:'wrong'},{locales:['en']},{locales:'malformed'},{decisionId:''},{approved:false}])assert.equal((await evaluateCategoryUnderstanding({cases,evaluate:oracle,independentReview:{...independentReview,...patch}})).releaseGatePassed,false);
 assert.equal((await evaluateCategoryUnderstanding({cases,evaluate:()=>answer([]),independentReview})).releaseGatePassed,false);
 assert.equal((await evaluateCategoryUnderstanding({cases,evaluate:row=>row.positiveUnsafe?answer(['89']):oracle(row),independentReview})).releaseGatePassed,false);
});
test('evaluation rejects invalid case datasets instead of reporting misleading success',async()=>{
 for(const cases of [[],[CASES[0],CASES[0]],[{...CASES[0],expectedCategoryIds:['172']}],[{...CASES[0],locale:'unknown'}]])await assert.rejects(()=>evaluateCategoryUnderstanding({cases,evaluate:oracle}),/Invalid/);
});
