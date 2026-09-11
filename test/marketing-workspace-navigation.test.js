const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
const resultsHtml = fs.readFileSync(require.resolve("../business-results.html"), "utf8");

function primaryNavigationLabels(source) {
  const primary = source.match(/<nav class="owner-workspace-navigation"[\s\S]*?<\/nav>/);
  assert.ok(primary);
  return Array.from(primary[0].matchAll(/<a[^>]*>([^<]+)<\/a>/g), (match) => match[1]);
}

test("Marketing Agent exposes its six workspace views and keeps Business Results separate", function () {
  const labels = Array.from(html.matchAll(/data-workspace-view="[^"]+"[^>]*>([^<]+)<\/button>/g), function (match) {
    return match[1];
  });
  assert.deepEqual(labels, [
    "Overview", "DEMEOS Recommends", "Create Marketing", "Campaigns", "Results", "Business Profile"
  ]);
  assert.match(html, /href="business-results\.html">View Business Results<\/a>/);
  assert.match(html, /id="results-view"/);
});

test("Marketing shares the Business Owner Workspace shell and primary navigation", function () {
  assert.match(html, /<body class="owner-workspace-body marketing-capability-body">/);
  assert.match(html, /<h1 class="restaurant-name">Business Owner Workspace<\/h1>/);
  assert.match(html, /<h2>Marketing Agent<\/h2>/);
  assert.deepEqual(primaryNavigationLabels(html), ["Overview", "Business Profile", "DEMEOS Recommends", "Marketing", "Results"]);
  assert.match(html, /class="is-active" href="index.html" aria-current="page">Marketing/);
  assert.doesNotMatch(html, /Business Marketing Intelligence|<p class="agent-label">DEMEOS<\/p>/);
});

test("Marketing uses the owner authentication presentation boundary", function () {
  assert.match(html, /id="owner-auth-loading"/);
  assert.match(html, /id="owner-auth-signed-out"[^>]*hidden/);
  assert.match(html, /id="owner-auth-error"[^>]*hidden/);
  assert.match(html, /id="owner-authenticated-workspace"[^>]*hidden/);
  assert.match(html, /id="owner-sign-in"/);
  assert.match(html, /id="owner-sign-out"/);
  assert.match(html, /<script src="js\/business-workspace\.js"><\/script>/);
});

test("Business Results shares the same owner shell, navigation and authentication boundary", function () {
  assert.match(resultsHtml, /<h1 class="restaurant-name">Business Owner Workspace<\/h1>/);
  assert.deepEqual(primaryNavigationLabels(resultsHtml), ["Overview", "Business Profile", "DEMEOS Recommends", "Marketing", "Results"]);
  assert.match(resultsHtml, /class="is-active" href="business-results.html" aria-current="page">Results/);
  assert.doesNotMatch(resultsHtml, /Back to Marketing Agent|<h1 class="restaurant-name">Business Results<\/h1>/);
  assert.match(resultsHtml, /id="owner-auth-loading"/);
  assert.match(resultsHtml, /id="owner-auth-signed-out"[^>]*hidden/);
  assert.match(resultsHtml, /id="owner-authenticated-workspace"[^>]*hidden/);
  assert.match(resultsHtml, /<script src="js\/business-workspace\.js"><\/script>/);
});

test("Business Results preserves its functional result IDs", function () {
  assert.match(resultsHtml, /id="business-results-business-name"/);
  assert.match(resultsHtml, /id="business-results-status"/);
  assert.match(resultsHtml, /id="business-results-zero"/);
  assert.match(resultsHtml, /id="business-results-list"/);
  assert.match(resultsHtml, /<script src="js\/business-results\.js"><\/script>/);
});

test("owner surfaces expose no customer or admin controls", function () {
  const source = `${html}\n${resultsHtml}`;
  assert.doesNotMatch(source, /DEMEOS Admin|admin control|customer navigation|customer login/i);
});

test("Overview is the only default Marketing workspace panel and profile, recommendations, creation, and results are separated", function () {
  assert.match(html, /id="overview" class="workspace-view is-active" data-workspace-panel(?! hidden)/);
  assert.match(html, /id="recommends" class="workspace-view" data-workspace-panel hidden/);
  assert.match(html, /id="create" class="workspace-view" data-workspace-panel hidden/);
  assert.match(html, /id="results-view" class="workspace-view" data-workspace-panel hidden/);
  assert.match(html, /id="business-profile" class="workspace-view" data-workspace-panel hidden/);
  assert.equal((html.match(/id="save-business-profile-btn"/g) || []).length, 1);
  assert.equal((html.match(/id="recommendations-btn"/g) || []).length, 1);
  assert.equal((html.match(/id="generate-btn"/g) || []).length, 1);
});

test("Overview quick create contains only supported campaign capabilities", function () {
  const capabilities = Array.from(html.matchAll(/data-quick-create="([^"]+)"/g), function (match) { return match[1]; });
  assert.deepEqual(capabilities, ["full", "social", "email"]);
  assert.doesNotMatch(html, /Explore approved DEMEOS work/);
  assert.doesNotMatch(html, />Customer Participation Results</);
});

test("Marketing Results retains campaign outcomes and participation signals", function () {
  assert.match(html, /id="campaign-results-list"/);
  assert.match(html, /id="customer-participation-results-list"/);
  assert.match(html, />Campaign Outcomes</);
  assert.match(html, />Participation Signals</);
});

test("Campaign Workspace is contained inside Create Marketing", function () {
  const createStart = html.indexOf('<section id="create"');
  const campaignsStart = html.indexOf('<section id="campaigns"');
  const workspaceStart = html.indexOf('<section id="results"');

  assert.ok(createStart >= 0, "Create Marketing view should exist");
  assert.ok(campaignsStart > createStart, "Campaigns view should follow Create Marketing");
  assert.ok(workspaceStart > createStart && workspaceStart < campaignsStart,
    "Campaign Workspace must be inside the Create Marketing view, not below all workspace panels");
  assert.equal((html.match(/id="results"/g) || []).length, 1);
});
