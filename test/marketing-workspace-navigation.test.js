const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("Marketing Agent keeps its workspace views and links separately to Business Results", function () {
  const labels = Array.from(html.matchAll(/data-workspace-view="[^"]+"[^>]*>([^<]+)<\/button>/g), function (match) {
    return match[1];
  });
  assert.deepEqual(labels, [
    "Overview", "DEMEOS Recommends", "Create Marketing", "Campaigns", "Business Profile"
  ]);
  assert.match(html, /<a class="workspace-nav-item workspace-nav-link" href="business-results\.html">Business Results<\/a>/);
  assert.doesNotMatch(html, /id="results-view"/);
});

test("Overview is the only default workspace panel and profile, recommendations, and creation are separated", function () {
  assert.match(html, /id="overview" class="workspace-view is-active" data-workspace-panel(?! hidden)/);
  assert.match(html, /id="recommends" class="workspace-view" data-workspace-panel hidden/);
  assert.match(html, /id="create" class="workspace-view" data-workspace-panel hidden/);
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
