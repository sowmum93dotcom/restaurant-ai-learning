const test=require("node:test");const assert=require("node:assert/strict");const catalog=require("../js/demeos-confirmation-additional-languages.js");
const keys=["stageLabel","heading","clarificationLabel","clarificationAction","confirmAction","changeAction","foundationTrust"];
test("six additional languages cover all stage-two interface labels",()=>{assert.deepEqual(Object.keys(catalog).sort(),["es","pt","zh","hi","de","ja"].sort());for(const item of Object.values(catalog)){assert.deepEqual(Object.keys(item),keys);assert.ok(Object.values(item).every(x=>typeof x==="string"&&x.trim()));}});
