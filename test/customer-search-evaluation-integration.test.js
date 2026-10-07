'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cases,catalogue}=require('./fixtures/customer-search-judged-cases.cjs');
const {prepareCustomerSearch}=require('../api/_lib/customer-search-service');
const {stablePossibilityId}=require('../api/_lib/customer-possibility-contract');
const {evaluateIntelligence}=require('../api/_lib/customer-intelligence-evaluation');
const {getCustomerSearchConfiguration,BASELINE_VERSION}=require('../api/_lib/customer-search-registry');
const {buildCustomerUnderstanding,confirmCustomerUnderstanding}=require('../js/customer-understanding');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
test('actual online baseline is evaluated against versioned synthetic integration judgments, not provider smoke responses',async()=>{
 const judged=[],predictions={};
 for(const c of cases){
  const prepared=await prepareCustomerSearch({understanding:confirmCustomerUnderstanding(buildCustomerUnderstanding('',c.request)),work:catalogue(),configuration:getCustomerSearchConfiguration()});
  const resultIds=prepared.possibilities.map(p=>p.possibilityId);assert.deepEqual(resultIds.slice().sort(),c.expected.map(stablePossibilityId).sort(),c.id);
  judged.push({id:c.id,locale:c.locale,eligibleIds:c.expected.map(stablePossibilityId),expectedResultIds:c.expected.map(stablePossibilityId),areas:c.areas,clarificationRequired:c.clarification,approvedFacts:{}});
  predictions[c.id]={resultIds,clarificationAsked:prepared.intention.ambiguity.length>0,factClaims:[]};
 }
 const result=evaluateIntelligence({cases:judged,predictions,version:BASELINE_VERSION});assert.equal(result.valid,true);assert.equal(result.safe,true);assert.equal(result.metrics.precision,1);assert.equal(result.metrics.hardConstraintViolationRate,0);assert.equal(result.metrics.clarificationAccuracy,1);
 assert.equal(result.complete,false);assert.ok(result.missingAreas.includes('multilingual'));assert.equal(result.missingLocales.length,8);
});
test('supported locale metadata does not invent constraints or constitute multilingual quality',async()=>{
 for(const locale of LOCALES){const prepared=await prepareCustomerSearch({understanding:confirmCustomerUnderstanding(buildCustomerUnderstanding('','jacket')),work:catalogue(),locale,configuration:getCustomerSearchConfiguration()});assert.equal(prepared.intention.locale,locale);assert.equal(prepared.intention.budget,null);assert.equal(prepared.possibilities.length,3);}
});
