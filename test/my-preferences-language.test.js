"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),language=require("../js/my-preferences-language.js");
test("My Preferences dynamic copy covers all nine approved languages",()=>{const codes=["en","es","fr","ar","pt","zh","hi","de","ja"];assert.deepEqual(Object.keys(language.copy),codes);codes.forEach(code=>{assert.equal(language.copy[code].length,14);language.copy[code].forEach(value=>assert.equal(typeof value==="string"&&value.length>0,true));});});
test("My Preferences keeps customer preference content outside translation copy",()=>{assert.equal(language.copy.en[1],"Remove");assert.equal(language.copy.en[13],"Preference saved.");assert.equal(Object.values(language.copy).some(values=>values.includes("preference.preference")),false);});
