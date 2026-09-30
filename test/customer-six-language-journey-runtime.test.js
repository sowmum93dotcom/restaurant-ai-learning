const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const base=path.join(__dirname,"../js/");
global.window={
 DEMEOSNavigationAdditionalCopy:require(base+"demeos-navigation-additional-languages.js"),
 DEMEOSDiscoverAdditionalCopy:require(base+"demeos-discover-additional-languages.js"),
 DEMEOSIntentionAdditionalCopy:require(base+"demeos-intention-additional-languages.js"),
 DEMEOSConfirmationAdditionalCopy:require(base+"demeos-confirmation-additional-languages.js"),
 DEMEOSResultsAdditionalCopy:require(base+"demeos-results-additional-languages.js"),
 DEMEOSPossibilitiesAdditionalCopy:require(base+"demeos-possibilities-additional-languages.js"),
 DEMEOSNoMatchAdditionalCopy:require(base+"demeos-no-match-additional-languages.js"),
 DEMEOSSaveAdditionalCopy:require(base+"demeos-save-additional-languages.js"),
 DEMEOSStatusAdditionalCopy:require(base+"demeos-status-additional-languages.js"),
 DEMEOSFeedbackAdditionalCopy:require(base+"demeos-feedback-additional-languages.js")
};
const c=require(base+"customer-interface-language.js");
const languages=["es","pt","zh","hi","de","ja"];

test("six additional languages have complete executable Customer Experience presentation",()=>{
 for(const code of languages){
  assert.equal(c.normalize(code),code);
  assert.equal(c.copy[code].length,c.copy.en.length);
  assert.equal(c.discoverCopy[code].length,c.discoverCopy.en.length);
  assert.equal(c.intentionLabels[code].length,c.intentionLabels.en.length);
  assert.deepEqual(Object.keys(c.journeyCopy[code]),Object.keys(c.journeyCopy.en));
  assert.deepEqual(Object.keys(c.confirmationCopy[code]),Object.keys(c.confirmationCopy.en));
  assert.deepEqual(Object.keys(c.resultCopy[code]),Object.keys(c.resultCopy.en));
  assert.deepEqual(Object.keys(c.possibilityCopy[code]).sort(),Object.keys(c.possibilityCopy.en).sort());
  assert.deepEqual(Object.keys(c.noMatchCopy[code]),Object.keys(c.noMatchCopy.en));
  assert.deepEqual(Object.keys(c.staticCopy[code]),Object.keys(c.staticCopy.en));
  assert.equal(c.statusCopy[code].length,c.statusCopy.en.length);
  assert.equal(c.additionalStatuses[code].length,c.additionalStatuses.en.length);
  assert.equal(c.feedbackCopy[code].length,c.feedbackCopy.en.length);
 }
});

test("known generated states localize in all six languages while unknown provided text remains verbatim",()=>{
 const unknown="Business provided text — keep exactly 123";
 for(const code of languages){
  assert.notEqual(c.localizeResult(c.resultCopy.en.none,code),c.resultCopy.en.none);
  assert.notEqual(c.localizeStatus(c.statusCopy.en[0],code),c.statusCopy.en[0]);
  assert.notEqual(c.localizeFeedback(c.feedbackCopy.en[0],code),c.feedbackCopy.en[0]);
  assert.notEqual(c.localizeDiscoverStatus(c.discoverCopy.en[0],code),c.discoverCopy.en[0]);
  assert.equal(c.localizeResult(unknown,code),unknown);
  assert.equal(c.localizeStatus(unknown,code),unknown);
  assert.equal(c.localizeFeedback(unknown,code),unknown);
  assert.equal(c.localizeDiscoverStatus(unknown,code),unknown);
 }
});

test("canonical intention values remain English while presentation labels localize",()=>{
 const canonical=["Explore","Eat","Shop","Book","Learn","Other"];
 assert.deepEqual(c.intentionLabels.en,canonical);
 for(const code of languages){
  assert.equal(c.intentionLabels[code].length,canonical.length);
  assert.notDeepEqual(c.intentionLabels[code],canonical);
 }
});
