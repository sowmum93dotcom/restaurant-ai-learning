'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {DATASET_VERSION, SECTORS, CATEGORIES, getCategory, getSector, validateReference, validateDataset, validateCategoryIds} = require('../api/_lib/marketing-agent-categories');
const data = require('../data/marketing-agent/categories-v1.json');
test('canonical classification exactly preserves nine supplied sectors and all 171 names and relationships', () => {
  assert.equal(SECTORS.length,9); assert.equal(CATEGORIES.length,171);
  assert.deepEqual(CATEGORIES.map(c => c.categoryId), Array.from({length:171},(_,i) => String(i+1)));
  assert.equal(new Set(CATEGORIES.map(c => c.categoryId)).size,171);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(CATEGORIES)).digest('hex'),'80ac3fdf14ac050c1607221693675495b8841a746b2c605e9c06ceacc373f6fd');
  for (const category of CATEGORIES) {
    assert.equal(category.datasetVersion,DATASET_VERSION);assert.equal(category.sectorId,String(Math.floor((Number(category.categoryId)-1)/19)+1));assert.equal(getSector(category.sectorId).sectorName,category.sectorName);
    assert.deepEqual(Object.keys(category).sort(),['categoryId','categoryName','datasetVersion','sectorId','sectorName']);
  }
  assert.equal(getCategory('20').categoryName,'SSC Wallet Infrastructure'); // inert name only
});
test('IDs and sector relationships fail closed with no uncontrolled additions', () => {
  for (const id of ['0','172','01',1,null,'__proto__','new-category']) assert.equal(getCategory(id),null);
  assert.equal(validateReference({categoryId:'10',sectorId:'2'}),null);
  assert.equal(validateReference({categoryId:'10',sectorId:'1',approved:true}),null);
  assert.deepEqual(validateReference({categoryId:'10',sectorId:'1'}),{categoryId:'10',sectorId:'1'});
  for (const mutate of [d=>d.categories.push({...d.categories[0]}),d=>d.categories[1].categoryId='1',d=>d.categories[0].sectorId='unknown',d=>{d.categories[0].sectorId='2';d.categories[0].sectorName=d.sectors[1].sectorName;},d=>d.categories[0].permission='activate',d=>d.sectors.pop(),d=>d.datasetVersion='unapproved']) {
    const altered=structuredClone(data);mutate(altered);assert.equal(validateDataset(altered),false);
  }
});
test('runtime records are immutable and isolated from writable JSON loader objects', () => {
  assert.throws(()=>{getCategory('10').categoryName='Changed';},TypeError);
  assert.throws(()=>{CATEGORIES.push({categoryId:'172'});},TypeError);
  assert.throws(()=>{SECTORS[0].sectorName='Changed';},TypeError);
  const prior=data.categories[9].categoryName;data.categories[9].categoryName='Untrusted mutation';assert.equal(getCategory('10').categoryName,prior);data.categories[9].categoryName=prior;
});

test('category ID list validation returns an immutable dense snapshot and respects explicit bounds', () => {
 const input=['89','93'],validated=validateCategoryIds(input,2);assert.deepEqual(validated,input);assert.ok(Object.isFrozen(validated));assert.notEqual(validated,input);
 input[0]='172';assert.deepEqual(validated,['89','93']);assert.deepEqual(validateCategoryIds([],0),[]);
 for(const [ids,limit] of [[['89'],0],[['172'],8],[['89','89'],8],[Array(1),8],[['89'],-1],[[],172],[[],NaN]])assert.equal(validateCategoryIds(ids,limit),null);
});
