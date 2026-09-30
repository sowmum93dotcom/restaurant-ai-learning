const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const html=fs.readFileSync(require("node:path").join(__dirname,"../customer.html"),"utf8");
test("customer page loads shared catalogues before interface language controller",()=>{const names=["demeos-language-registry","demeos-discover-additional-languages","demeos-intention-additional-languages","demeos-confirmation-additional-languages","demeos-results-additional-languages","customer-interface-language"];let previous=-1;for(const name of names){const index=html.indexOf('src="js/'+name+'.js"');assert.ok(index>previous,name+" missing or out of order");previous=index;}});
test("unfinished languages are not exposed in selector",()=>{const controller=fs.readFileSync(require("node:path").join(__dirname,"../js/customer-interface-language.js"),"utf8");assert.match(controller,/var supported = \["en", "fr", "ar"\]/);});


test("additional-language catalogues preserve canonical and provided data boundaries",()=>{
 const controller=fs.readFileSync(require("node:path").join(__dirname,"../js/customer-interface-language.js"),"utf8");
 const intention=fs.readFileSync(require("node:path").join(__dirname,"../js/demeos-intention-additional-languages.js"),"utf8");
 const confirmation=fs.readFileSync(require("node:path").join(__dirname,"../js/demeos-confirmation-additional-languages.js"),"utf8");
 const feedback=fs.readFileSync(require("node:path").join(__dirname,"../js/demeos-feedback-additional-languages.js"),"utf8");
 assert.match(controller,/data-canonical-intention/);
 assert.match(controller,/intentionLabels\.en\.indexOf\(canonical\)/);
 assert.match(intention,/canonical intention values stay English/);
 assert.match(confirmation,/Customer clarification remains verbatim/);
 assert.match(feedback,/do not alter recorded canonical response values/);
});
