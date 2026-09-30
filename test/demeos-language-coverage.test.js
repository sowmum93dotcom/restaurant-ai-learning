const test = require("node:test");
const assert = require("node:assert/strict");
const gate = require("../js/demeos-language-coverage.js");
const registry = require("../js/demeos-language-registry.js");

test("nine-language catalogue and release evidence stay aligned with the registry", () => {
  const languages = registry.languages.map(x => x.code);
  assert.deepEqual(Object.keys(gate.complete).sort(), languages.slice().sort());
  assert.deepEqual(gate.enabled.slice().sort(), languages.slice().sort());
  assert.deepEqual(gate.verifiedJourneys.slice().sort(), languages.slice().sort());
  for (const { code } of registry.languages) {
    assert.deepEqual(gate.missing(code), []);
    assert.equal(gate.journeyVerified(code), true);
    assert.equal(gate.releaseReady(code), true);
    assert.equal(gate.selectable(code), true);
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
  assert.throws(() => gate.enabled.push("xx"), TypeError);
  assert.throws(() => gate.verifiedJourneys.push("xx"), TypeError);
});
