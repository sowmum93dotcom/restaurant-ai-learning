const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const auth=require("../js/my-demeos-auth-language.js");test("all nine languages cover every authentication presentation state",()=>{assert.equal(Object.keys(auth.copy).length,9);for(const values of Object.values(auth.copy)){assert.deepEqual(Object.keys(values).sort(),Object.keys(auth.selectors).sort());assert.ok(Object.values(values).every(v=>typeof v==="string"&&v.trim()));}});test("auth catalogue loads before foundation and preserves sign-in arrow",()=>{const html=fs.readFileSync(require("node:path").join(__dirname,"../my-demeos.html"),"utf8");assert.ok(html.indexOf('src="js/my-demeos-auth-language.js"')<html.indexOf('src="js/my-demeos-language-foundation.js"'));assert.match(fs.readFileSync(require("node:path").join(__dirname,"../js/my-demeos-auth-language.js"),"utf8"),/text\.nodeType===3/);});


test("My DEMEOS language changes reapply every authentication presentation state without changing auth decisions",()=>{
 const foundation=fs.readFileSync(require("node:path").join(__dirname,"../js/my-demeos-language-foundation.js"),"utf8");
 const authSource=fs.readFileSync(require("node:path").join(__dirname,"../js/my-demeos-auth-language.js"),"utf8");
 assert.match(foundation,/if\(root\.DEMEOSMyAuthLanguage\)root\.DEMEOSMyAuthLanguage\.apply\(doc,code\)/);
 assert.match(foundation,/control\.addEventListener\("change",function\(\)\{apply\(root\.document,control\.value\);\}\)/);
 for(const code of ["en","fr","ar","es","pt","zh","hi","de","ja"]){
  const values=auth.copy[code];
  for(const key of ["loadingTitle","loadingDetail","signedOutTitle","signedOutDetail","signIn","signedInTitle","signedInDetail","anonymousDetail","signOut","unavailableTitle","unavailableDetail","providerDetail"]) assert.ok(values[key]&&values[key].trim());
 }
 assert.doesNotMatch(authSource,/signInWith|signOut\(|session|authenticate|redirectToSignIn/);
});
