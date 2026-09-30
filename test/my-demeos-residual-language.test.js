"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../js/my-demeos-language-foundation.js"),"utf8");
test("residual My DEMEOS presentation covers all nine approved languages",()=>{for(const code of ["en","es","fr","ar","pt","zh","hi","de","ja"])assert.equal(source.includes(code+':["'),true);assert.match(source,/var residualCopy=\{/);assert.match(source,/residualSelectors\.forEach/);});
test("My DEMEOS page accessibility labels are localized",()=>{assert.match(source,/var pageA11yCopy=\{/);assert.match(source,/pageA11ySelectors\.forEach/);assert.match(source,/setAttribute\(item\[1\],pageA11yCopy\[code\]\[index\]\)/);});
test("residual localization preserves evidence semantics",()=>{assert.match(source,/Interest remains interest\. Feedback remains feedback\./);assert.match(source,/not automatically a purchase, sale or success/);});
