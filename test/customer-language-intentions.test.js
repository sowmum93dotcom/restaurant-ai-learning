const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");
const {intentionLabels}=require("../js/customer-interface-language.js");
test("translated intention choices retain one-to-one canonical meaning",()=>{for(const lang of ["fr","ar"]){assert.equal(intentionLabels[lang].length,intentionLabels.en.length);assert.equal(new Set(intentionLabels[lang]).size,6);}});
test("customer buttons carry canonical intention independent of visible language",()=>{const source=fs.readFileSync(require.resolve("../js/customer.js"),"utf8");assert.match(source,/setAttribute\("data-canonical-intention", label\)/);assert.match(source,/selectedIntention = selectCustomerIntention\(label\)/);});
