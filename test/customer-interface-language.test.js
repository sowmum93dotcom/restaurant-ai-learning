const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {normalize,copy}=require("../js/customer-interface-language.js");
test("explicit language selection supports regional preferences and safe fallback",()=>{
 assert.equal(normalize("fr-CA"),"fr");assert.equal(normalize("ar-SA"),"ar");assert.equal(normalize("zh-Hant"),"en");assert.equal(normalize(null),"en");
 for(const lang of ["en","fr","ar"]){assert.equal(copy[lang].length,11);assert.ok(copy[lang].every(Boolean));}
});
test("both customer destinations load the same language control",()=>{
 for(const page of ["customer.html","my-demeos.html"]){const html=fs.readFileSync(require.resolve("../"+page),"utf8");assert.match(html,/css\/customer-interface-language\.css/);assert.match(html,/js\/customer-interface-language\.js/);}
});
