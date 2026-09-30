const test = require("node:test");
const assert = require("node:assert/strict");
const gate = require("../js/demeos-language-coverage.js");
const registry = require("../js/demeos-language-registry.js");

test("nine-language catalogue presence does not certify a full journey or expand availability", () => {
  assert.deepEqual(Object.keys(gate.complete).sort(), registry.languages.map(x => x.code).sort());
  assert.deepEqual(gate.enabled, ["en", "fr", "ar"]);
  for (const { code } of registry.languages) {
    assert.deepEqual(gate.missing(code), []);
    assert.equal(gate.journeyVerified(code), false);
    assert.equal(gate.releaseReady(code), false);
    assert.equal(gate.selectable(code), gate.enabled.includes(code));
  }
});

test("unknown language cannot be certified or enabled", () => {
  assert.deepEqual(gate.missing("xx"), gate.required);
  assert.equal(gate.journeyVerified("xx"), false);
  assert.equal(gate.releaseReady("xx"), false);
  assert.equal(gate.selectable("xx"), false);
});

test("coverage and availability evidence cannot be mutated", () => {
  assert.throws(() => gate.complete.es.push("unverified"), TypeError);
  assert.throws(() => gate.enabled.push("es"), TypeError);
  assert.throws(() => gate.verifiedJourneys.push("es"), TypeError);
});
