const test=require('node:test');
const assert=require('node:assert/strict');
const copy=require('../js/demeos-controlled-customer-copy');
test('controlled copy covers the same nine customer languages, every fixture and interface key',()=>{
 assert.deepEqual(Object.keys(copy).sort(),['ar','de','en','es','fr','hi','ja','pt','zh']);
 const keys=Object.keys(copy.en).sort();
 for(const [language,table] of Object.entries(copy)) {
  assert.deepEqual(Object.keys(table).sort(),keys,language);
  assert.equal(table.categories.length,6,language);
  assert.equal(table.products.length,11,language);
  for(const value of Object.values(table).flat()) assert.ok(typeof value==='string'&&value.trim(),language);
  for(const key of ['content','description','media']) {
   assert.deepEqual(table[key].match(/\{\w+\}/g).sort(),copy.en[key].match(/\{\w+\}/g).sort(),language+' placeholders');
  }
 }
});
