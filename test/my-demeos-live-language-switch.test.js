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
      if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: "", checked: false, value: "", dataset: {},
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


test("language change preserves unsaved preference text", async () => {
  const f = fixture();
  f.document.getElementById("customer-preference").value = "Keep this unsaved preference";
  const requests = [];
  setupLiveLanguageRefresh(f.document, async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ intentions: [], possibilities: [], participations: [], controls: { usePreferencesAsGuidance: true, useFeedbackAsGuidance: false } }) };
  });
  await f.change();
  assert.equal(f.document.getElementById("customer-preference").value, "Keep this unsaved preference");
  assert.equal(requests.some(r => r.url === "/api/customer/preferences"), false);
  assert.equal(requests.some(r => r.url === "/api/customer/privacy-controls"), true);
});

test("language change preserves unsaved privacy toggles", async () => {
  const f = fixture();
  const form = f.document.getElementById("privacy-controls-form");
  form.dataset.loadedPreferencesGuidance = "true";
  form.dataset.loadedFeedbackGuidance = "false";
  f.document.getElementById("use-preferences-as-guidance").checked = false;
  f.document.getElementById("use-feedback-as-guidance").checked = false;
  const requests = [];
  setupLiveLanguageRefresh(f.document, async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ intentions: [], possibilities: [], participations: [], preferences: [] }) };
  });
  await f.change();
  assert.equal(f.document.getElementById("use-preferences-as-guidance").checked, false);
  assert.equal(requests.some(r => r.url === "/api/customer/privacy-controls"), false);
  assert.equal(requests.some(r => r.url === "/api/customer/preferences"), true);
});


test("failed language refresh reads preserve already rendered private data and controls", async () => {
  const f = fixture();
  const preserved = {
    "my-intentions-list": "Saved intention remains visible",
    "my-possibilities-list": "Saved possibility remains visible",
    "my-participation-list": "Participation remains visible",
    "my-preferences-list": "Preference remains visible"
  };
  for (const [id, value] of Object.entries(preserved)) f.document.getElementById(id).textContent = value;
  f.document.getElementById("use-preferences-as-guidance").checked = true;
  f.document.getElementById("use-feedback-as-guidance").checked = false;
  setupLiveLanguageRefresh(f.document, async () => ({ ok: false, json: async () => ({}) }));
  await f.change();
  for (const [id, value] of Object.entries(preserved)) assert.equal(f.document.getElementById(id).textContent, value);
  assert.equal(f.document.getElementById("use-preferences-as-guidance").checked, true);
  assert.equal(f.document.getElementById("use-feedback-as-guidance").checked, false);
});
