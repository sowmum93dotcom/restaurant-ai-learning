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


test("Discover, I know what I want and My DEMEOS share one persisted language state",()=>{
 const controller=fs.readFileSync(require.resolve("../js/customer-interface-language.js"),"utf8");
 const customer=fs.readFileSync(require.resolve("../customer.html"),"utf8");
 const myDemeos=fs.readFileSync(require.resolve("../my-demeos.html"),"utf8");
 assert.match(controller,/getItem\("demeos-customer-language"\)/);
 assert.match(controller,/setItem\("demeos-customer-language", value\)/);
 assert.match(controller,/var preferred = getSaved\(\) \|\|/);
 assert.match(customer,/href="#discover"/);
 assert.match(customer,/href="#intention"/);
 assert.match(customer,/href="my-demeos\.html"/);
 assert.match(myDemeos,/href="customer\.html#discover"/);
 assert.match(myDemeos,/href="customer\.html#intention"/);
 for(const page of [customer,myDemeos]) assert.match(page,/js\/customer-interface-language\.js/);
});
