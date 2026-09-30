"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { setupLiveLanguageRefresh } = require("../js/my-demeos.js");

function fixture(hidden = false) {
  let change;
  const nodes = new Map();
  const document = {
    addEventListener(name, handler) { if (name === "change") change = handler; },
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: "", checked: false,
        querySelector() { return { disabled: false }; },
        addEventListener(name, handler) { if (id === "customer-language" && name === "change") change = handler; }
      });
      return nodes.get(id);
    }
  };
  document.getElementById("customer-auth-signed-in").hidden = hidden;
  return { document, nodes, change: (id = "customer-language") => change({ target: { id } }) };
}

test("language changes refresh all five areas using reads only", async () => {
  const f = fixture();
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({
      intentions: [], possibilities: [], participations: [], preferences: [],
      controls: { usePreferencesAsGuidance: true, useFeedbackAsGuidance: false }
    }) };
  };
  setupLiveLanguageRefresh(f.document, fetch);
  await f.change();
  assert.deepEqual(requests.map(r => r.url).sort(), [
    "/api/customer/intentions", "/api/customer/possibilities/saved",
    "/api/customer/participation", "/api/customer/preferences", "/api/customer/privacy-controls"
  ].sort());
  for (const { options } of requests) {
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.credentials, "same-origin");
  }
  assert.equal(f.nodes.get("use-preferences-as-guidance").checked, true);
  assert.equal(f.nodes.get("use-feedback-as-guidance").checked, false);
});

test("signed out language changes do not request private data", async () => {
  const f = fixture(true);
  let calls = 0;
  setupLiveLanguageRefresh(f.document, async () => { calls++; });
  await f.change();
  assert.equal(calls, 0);
});

test("other controls do not trigger private refreshes", async () => {
  const f = fixture();
  let calls = 0;
  setupLiveLanguageRefresh(f.document, async () => { calls++; });
  await f.change("customer-preference");
  assert.equal(calls, 0);
});

test("listener registers before the selector exists", () => {
  let listener;
  setupLiveLanguageRefresh({
    addEventListener(name, handler) { assert.equal(name, "change"); listener = handler; },
    getElementById() { throw new Error("Selector is not created yet"); }
  }, async () => {});
  assert.equal(typeof listener, "function");
});


test("repeated language changes remain read-only and refresh every private area", async () => {
  const f = fixture();
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({
      intentions: [], possibilities: [], participations: [], preferences: [],
      controls: { usePreferencesAsGuidance: true, useFeedbackAsGuidance: false }
    }) };
  };
  setupLiveLanguageRefresh(f.document, fetch);
  await f.change();
  await f.change();
  assert.equal(requests.length, 10);
  const counts = requests.reduce((result, request) => {
    result[request.url] = (result[request.url] || 0) + 1;
    return result;
  }, {});
  for (const url of [
    "/api/customer/intentions", "/api/customer/possibilities/saved",
    "/api/customer/participation", "/api/customer/preferences", "/api/customer/privacy-controls"
  ]) assert.equal(counts[url], 2);
  for (const { options } of requests) {
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.credentials, "same-origin");
  }
});
