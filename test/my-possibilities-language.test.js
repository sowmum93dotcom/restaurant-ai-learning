"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),language=require("../js/my-possibilities-language.js");
test("My Possibilities dynamic copy covers all nine approved languages",()=>{const codes=["en","es","fr","ar","pt","zh","hi","de","ja"];assert.deepEqual(Object.keys(language.copy),codes);codes.forEach(code=>{assert.equal(language.copy[code].length,27);language.copy[code].forEach(value=>assert.equal(typeof value==="string"&&value.length>0,true));});});
test("My Possibilities preserves the presentation contract",()=>{assert.equal(language.copy.en[0],"Provided by ");assert.equal(language.copy.en[19],"Remove");assert.equal(language.copy.en[25],"Saved possibility removed.");});
