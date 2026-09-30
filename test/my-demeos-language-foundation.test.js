const path = require("node:path");
const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const foundation=require("../js/my-demeos-language-foundation.js");test("nine languages have ten static labels and Arabic RTL normalization",()=>{assert.equal(Object.keys(foundation.copy).length,9);for(const values of Object.values(foundation.copy)){assert.equal(values.length,foundation.selectors.length);assert.ok(values.every(x=>typeof x==="string"&&x.trim()));}assert.equal(foundation.normalize("ar-GB"),"ar");assert.equal(foundation.normalize("xx"),"en");});test("private page uses isolated language controller",()=>{const html=fs.readFileSync(require("node:path").join(__dirname,"../my-demeos.html"),"utf8");assert.ok(html.includes('src="js/my-demeos-language-foundation.js"'));assert.ok(html.includes('src="js/customer-interface-language.js"'));});


test("My DEMEOS loads language presentation before its data and authentication runtime",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","my-demeos.html"),"utf8");
 const controller=html.indexOf('src="js/customer-interface-language.js"');
 const authLanguage=html.indexOf('src="js/my-demeos-auth-language.js"');
 const foundation=html.indexOf('src="js/my-demeos-language-foundation.js"');
 const runtime=html.indexOf('src="js/my-demeos.js"');
 assert.ok(controller>=0&&authLanguage>controller&&foundation>authLanguage&&runtime>foundation);
});
