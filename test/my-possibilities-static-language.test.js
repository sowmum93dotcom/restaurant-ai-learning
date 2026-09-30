"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../js/my-demeos-language-foundation.js"),"utf8");
test("My Possibilities static presentation is defined for all nine approved languages",()=>{for(const code of ["en","es","fr","ar","pt","zh","hi","de","ja"])assert.match(source,new RegExp(code+':\\\\["'));assert.match(source,/var possibilitiesCopy=\{/);assert.match(source,/possibilitiesSelectors\.forEach/);});
test("My Possibilities static localization does not translate record data",()=>{assert.doesNotMatch(source,/possibility\.businessName\s*=/);assert.doesNotMatch(source,/possibility\.description\s*=/);assert.doesNotMatch(source,/possibility\.feedback\s*=/);});
