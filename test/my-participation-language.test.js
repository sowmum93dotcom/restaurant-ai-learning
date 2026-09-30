"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),language=require("../js/my-participation-language.js");
test("My Participation dynamic copy covers all nine approved languages",()=>{const codes=["en","es","fr","ar","pt","zh","hi","de","ja"];assert.deepEqual(Object.keys(language.copy),codes);codes.forEach(code=>{assert.equal(language.copy[code].length,5);language.copy[code].forEach(value=>assert.equal(typeof value==="string"&&value.length>0,true));});});
test("My Participation preserves the interest-signal presentation contract",()=>{assert.equal(language.copy.en[0],"Interested");assert.equal(language.copy.en[1],"Provided by ");});
