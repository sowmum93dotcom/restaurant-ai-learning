const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync(require.resolve("../index.html"), "utf8");

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
  const primary = html.match(/<nav class="owner-workspace-navigation"[\s\S]*?<\/nav>/);
  assert.ok(primary);
  const labels = Array.from(primary[0].matchAll(/<a[^>]*>([^<]+)<\/a>/g), (match) => match[1]);
  assert.deepEqual(labels, ["Overview", "Business Profile", "DEMEOS Recommends", "Marketing", "Results"]);
  assert.match(primary[0], /class="is-active" href="index.html" aria-current="page">Marketing/);
  assert.doesNotMatch(html, /Business Marketing Intelligence|<p class="agent-label">DEMEOS<\/p>/);
});

test("owner surfaces expose no customer or admin controls", function () {
  assert.doesNotMatch(html, /DEMEOS Admin|admin control|customer navigation|customer login/i);
});

test("Overview is the only default workspace panel and profile, recommendations, creation, and results are separated", function () {
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
