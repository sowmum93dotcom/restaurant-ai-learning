const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const {localizeResult,resultCopy}=require("../js/customer-interface-language.js");
test("late result messages and language switches are translated without modifying arbitrary text",()=>{for(const code of ["en","fr","ar"]){for(const value of Object.values(resultCopy.en))assert.ok(Object.values(resultCopy[code]).includes(localizeResult(value,code)));}assert.equal(localizeResult("A business-provided title","ar"),"A business-provided title");});
test("result observer avoids self-triggering mutations",()=>{const source=fs.readFileSync(require.resolve("../js/customer-interface-language.js"),"utf8");assert.match(source,/if \(localized !== current\) resultHeading\.textContent = localized/);});


test("language localization leaves business-provided names descriptions locations prices and availability notes verbatim",()=>{
 const provided=[
  "Café Étoile 東京",
  "Chef's وصف خاص — 家庭料理",
  "München Zentrum · شارع النيل",
  "£22.50 / ¥4,800",
  "Nur freitags — الجمعة فقط"
 ];
 for(const code of ["en","fr","ar"]){
  for(const value of provided) assert.equal(localizeResult(value,code),value);
 }
});
