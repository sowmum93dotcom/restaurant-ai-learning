'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CASES,VERSION}=require('../api/_lib/customer-category-eval-set');
const {evaluateCategoryUnderstanding}=require('../api/_lib/customer-category-evaluation');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {LOCALES,fingerprint}=require('../api/_lib/customer-evidence-provenance');
const answer=ids=>({interpretation:{datasetVersion:DATASET_VERSION,categoryIds:ids}});
const expected=row=>CASES.find(fixture=>fixture.caseId===row.caseId);
const oracle=row=>answer(expected(row).expectedCategoryIds); // Explicit external specification oracle, not AI.
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
 assert.equal((await evaluateCategoryUnderstanding({cases,evaluate:row=>expected(row).positiveUnsafe?answer(['89']):oracle(row),independentReview})).releaseGatePassed,false);
});
test('evaluation rejects invalid case datasets instead of reporting misleading success',async()=>{
 for(const cases of [[],[CASES[0],CASES[0]],[{...CASES[0],expectedCategoryIds:['172']}],[{...CASES[0],locale:'unknown'}]])await assert.rejects(()=>evaluateCategoryUnderstanding({cases,evaluate:oracle}),/Invalid/);
});

test('sparse output cannot masquerade as a category or pass an independently reviewed release gate',async()=>{
 const cases=CASES.map(row=>({...row,judgement:'independently-judged'}));
 const independentReview={approved:true,datasetVersion:VERSION,datasetFingerprint:fingerprint(cases),decisionId:'controlled-independent-fixture',locales:[...LOCALES]};
 const result=await evaluateCategoryUnderstanding({cases,independentReview,evaluate:row=>answer(expected(row).expectedCategoryIds.length===1?Array(1):expected(row).expectedCategoryIds)});
 assert.equal(result.counts['unsafe-classification'],cases.filter(row=>row.expectedCategoryIds.length===1).length);
 assert.equal(result.releaseGatePassed,false);
 for(const ids of [Array(1),['89',,'93']]){
  const result=await evaluateCategoryUnderstanding({cases:[CASES[0]],evaluate:()=>answer(ids)});assert.equal(result.rows[0].status,'unsafe-classification');
 }
 await assert.rejects(()=>evaluateCategoryUnderstanding({cases:[{...CASES[0],expectedCategoryIds:Array(1)}],evaluate:oracle}),/Invalid category evaluation case/);
});

test('category evaluation ignores overridden callbacks/iterators and rejects inherited/accessor indices',async()=>{
 const inherited=Array(1);Object.setPrototypeOf(inherited,{0:'89'});
 const accessor=['89'];Object.defineProperty(accessor,0,{get(){throw new Error('must not execute');}});
 const duplicates=['89','89'];duplicates[Symbol.iterator]=function*(){yield '89';yield '93';};
 for(const ids of [inherited,accessor,duplicates]){
  const result=await evaluateCategoryUnderstanding({cases:[CASES[0]],evaluate:()=>answer(ids)});assert.equal(result.rows[0].status,'unsafe-classification');
 }
 const wrong=['93'];wrong.every=()=>true;
 const result=await evaluateCategoryUnderstanding({cases:[CASES[0]],evaluate:()=>answer(wrong)});assert.equal(result.rows[0].status,'incorrect-classification');assert.equal(result.releaseGatePassed,false);
});

test('evaluation comparison, fingerprint and judgement use immutable snapshots despite caller mutation',async()=>{
 const cases=CASES.map(row=>({...row,expectedCategoryIds:[...row.expectedCategoryIds],judgement:'independently-judged'}));
 const originalFingerprint=fingerprint(cases),review={approved:true,datasetVersion:VERSION,datasetFingerprint:originalFingerprint,decisionId:'controlled-independent-fixture',locales:[...LOCALES]};
 const result=await evaluateCategoryUnderstanding({cases,independentReview:review,evaluate:row=>{
  const original=cases.find(item=>item.caseId===row.caseId);original.expectedCategoryIds.length=0;original.judgement='specification-only';original.locale='en';original.positiveUnsafe=false;
  return answer([]);
 }});
 assert.equal(result.datasetFingerprint,originalFingerprint);assert.equal(result.independentlyReviewed,true);assert.equal(result.rows.length,CASES.length);
 assert.equal(result.counts['correct-classification'],CASES.filter(row=>!row.expectedCategoryIds.length).length);
 assert.equal(result.counts['safe-fallback'],CASES.filter(row=>row.expectedCategoryIds.length&&row.allowFallback).length);
 assert.equal(result.releaseGatePassed,false);for(const locale of LOCALES)assert.ok(result.locales[locale].cases>0);
});

test('evaluator receives no labels or judgement and cannot self-approve by mutating review metadata',async()=>{
 const cases=CASES.map(row=>({...row,judgement:'independently-judged'}));
 const review={approved:false,datasetVersion:VERSION,datasetFingerprint:fingerprint(cases),decisionId:'controlled-independent-fixture',locales:[...LOCALES]};
 const result=await evaluateCategoryUnderstanding({cases,independentReview:review,evaluate:row=>{
  assert.deepEqual(Object.keys(row).sort(),['caseId','locale','responseScenario','text']);assert.ok(Object.isFrozen(row));
  review.approved=true;return oracle(row);
 }});
 assert.equal(result.counts['correct-classification'],CASES.length);assert.equal(result.independentlyReviewed,false);assert.equal(result.releaseGatePassed,false);
});

test('evaluation snapshots reject private extra fields, accessors and sparse case lists',async()=>{
 const accessor={...CASES[0]};Object.defineProperty(accessor,'text',{get(){throw new Error('must not read');}});
 for(const cases of [[{...CASES[0],customerEmail:'private@example.com'}],[accessor],Array(1)])await assert.rejects(()=>evaluateCategoryUnderstanding({cases,evaluate:oracle}),/Invalid category evaluation case/);
});
