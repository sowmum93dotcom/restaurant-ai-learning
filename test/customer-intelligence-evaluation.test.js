const test=require('node:test'),assert=require('node:assert/strict');
const {evaluateIntelligence,AREAS}=require('../api/_lib/customer-intelligence-evaluation');
const {CUSTOMER_INTELLIGENCE_EVAL_SET_V2:cases}=require('../api/_lib/customer-intelligence-eval-set');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
const predictions=Object.fromEntries(cases.map(c=>[c.id,{resultIds:c.expectedResultIds.slice(),clarificationAsked:false,factClaims:[{resultId:'black-jacket',field:'colour',value:'black'}]}]));
test('nine-language smoke contract uses repository locales and reports missing evaluation coverage',()=>{
 const r=evaluateIntelligence({cases,predictions,version:'candidate-v1'});assert.equal(r.valid,true);assert.deepEqual(Object.keys(r.localeCoverage),LOCALES);assert.equal(r.complete,false);assert.ok(r.missingAreas.includes('budget'));assert.equal(r.metrics.precision,1);assert.equal(r.metrics.ndcg,1);
});
test('invented fact or ineligible result fails integrity despite perfect other cases',()=>{
 const p=structuredClone(predictions);p[cases[0].id].factClaims[0].value='red';assert.equal(evaluateIntelligence({cases,predictions:p,version:'v'}).safe,false);
 p[cases[0].id].resultIds=['red-jacket'];assert.ok(evaluateIntelligence({cases,predictions:p,version:'v'}).metrics.hardConstraintViolationRate>0);
});
test('rank metrics reflect order and no-result correctness and clarification',()=>{
 const c={id:'q',locale:'en',eligibleIds:['a','b'],expectedResultIds:['b'],areas:['relevance'],clarificationRequired:true,approvedFacts:{}};
 const r=evaluateIntelligence({cases:[c],predictions:{q:{resultIds:['a','b'],clarificationAsked:false,factClaims:[]}},version:'v'});assert.equal(r.metrics.precision,.5);assert.equal(r.metrics.recall,1);assert.equal(r.metrics.mrr,.5);assert.equal(r.metrics.clarificationAccuracy,0);
 const empty={...c,expectedResultIds:[],clarificationRequired:false};assert.equal(evaluateIntelligence({cases:[empty],predictions:{q:{resultIds:[],clarificationAsked:false,factClaims:[]}},version:'v'}).metrics.unsupportedPrecision,1);
});
test('complete coverage requires every declared area and every supported locale',()=>{
 const all=cases.map(c=>({...c,areas:AREAS.slice()}));assert.equal(evaluateIntelligence({cases:all,predictions,version:'v'}).complete,true);
 const missing=all.slice(1);assert.deepEqual(evaluateIntelligence({cases:missing,predictions,version:'v'}).missingLocales,['en']);
});
test('malformed judged cases fail closed',()=>{
 assert.equal(evaluateIntelligence({cases:[null],predictions:{},version:'candidate-v1'}).valid,false);
});
