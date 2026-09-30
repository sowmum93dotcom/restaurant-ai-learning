const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {normalize,copy}=require("../js/customer-interface-language.js");
test("explicit language selection supports regional preferences and safe fallback",()=>{
 assert.equal(normalize("fr-CA"),"fr");assert.equal(normalize("ar-SA"),"ar");assert.equal(normalize("zh-Hant"),"zh");assert.equal(normalize("ja-JP"),"ja");assert.equal(normalize(null),"en");
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


test("Arabic uses RTL-safe logical alignment while customer-entered fields keep automatic direction",()=>{
 const languageCss=fs.readFileSync(require.resolve("../css/customer-interface-language.css"),"utf8");
 const mobileCss=fs.readFileSync(require.resolve("../css/customer-mobile-refinement.css"),"utf8");
 const spaceCss=fs.readFileSync(require.resolve("../css/demeos-customer-space.css"),"utf8");
 const controller=fs.readFileSync(require.resolve("../js/customer-interface-language.js"),"utf8");
 assert.match(controller,/documentElement\.dir\s*=\s*code\s*===\s*"ar"\s*\?\s*"rtl"\s*:\s*"ltr"/);
 assert.match(languageCss,/\[dir=rtl\]/);
 assert.match(languageCss,/#customer-intention-text,#customer-place\{direction:auto\}/);
 assert.doesNotMatch(mobileCss,/text-align:left/);
 assert.doesNotMatch(spaceCss,/text-align:left/);
 assert.match(mobileCss,/border-inline-start:3px solid #b78d38/);
});


test("Customer Experience language controls remain responsive for longer translated labels",()=>{
 const languageCss=fs.readFileSync(require.resolve("../css/customer-interface-language.css"),"utf8");
 const mobileCss=fs.readFileSync(require.resolve("../css/customer-mobile-refinement.css"),"utf8");
 assert.match(languageCss,/\.customer-language-control\{[^}]*min-width:0/);
 assert.match(languageCss,/@media\(max-width:680px\)[\s\S]*?\.customer-language-control select\{[^}]*width:min\(100%,180px\)[^}]*max-width:100%[^}]*min-width:0/);
 assert.match(mobileCss,/\.customer-journey-nav a,[\s\S]*?white-space:normal/);
 assert.match(mobileCss,/@media\(max-width:680px\)\{\.customer-body #discover \.customer-connection-entry[^}]*\}[\s\S]*?\.customer-connection-action \{width:100%;white-space:normal\}/);
});


test("six additional languages execute internally while visible selector remains gated",()=>{
 const controller=fs.readFileSync(require.resolve("../js/customer-interface-language.js"),"utf8");
 for(const code of ["es","pt","zh","hi","de","ja"]) assert.equal(normalize(code),code);
 assert.match(controller,/var selectable = \["en", "fr", "ar"\]/);
 assert.match(controller,/\[\["en","English"\],\["fr","Français"\],\["ar","العربية"\]\]\.forEach/);
});
