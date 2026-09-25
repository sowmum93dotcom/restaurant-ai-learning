const test = require("node:test");
const assert = require("node:assert/strict");
const { getPreferredLanguage } = require("../js/customer.js");

test("preserves international browser language tags", () => {
  assert.equal(getPreferredLanguage({ languages: ["ar-SA", "en-GB"], language: "en-GB" }), "ar-SA");
  assert.equal(getPreferredLanguage({ languages: ["fr-CA", "en"], language: "en" }), "fr-CA");
  assert.equal(getPreferredLanguage({ languages: ["zh-Hant-TW"], language: "en" }), "zh-Hant-TW");
});

test("uses first available preference and falls back safely", () => {
  assert.equal(getPreferredLanguage({ languages: ["", "  ", "he-IL"], language: "en-GB" }), "he-IL");
  assert.equal(getPreferredLanguage({ languages: [], language: "pt-BR" }), "pt-BR");
  assert.equal(getPreferredLanguage({ languages: [null, 123], language: "" }), "en");
  assert.equal(getPreferredLanguage(null), "en");
});
