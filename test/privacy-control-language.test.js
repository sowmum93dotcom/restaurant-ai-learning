"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),language=require("../js/privacy-control-language.js");
test("Privacy and Control dynamic copy covers all nine approved languages",()=>{const codes=["en","es","fr","ar","pt","zh","hi","de","ja"];assert.deepEqual(Object.keys(language.copy),codes);codes.forEach(code=>{assert.equal(language.copy[code].length,8);language.copy[code].forEach(value=>assert.equal(typeof value==="string"&&value.length>0,true));});});
test("Privacy and Control keeps evidence meanings separate",()=>{assert.match(language.copy.en[6],/Privacy controls saved/);assert.equal(Object.values(language.copy).some(values=>values.some(value=>/purchase confirmed|booking confirmed|sale confirmed/i.test(value))),false);});
