const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const ownerPages = ["business-workspace.html", "index.html", "business-results.html"];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function ownerNavigation(html) {
  const match = html.match(/<nav class="owner-workspace-navigation"[\s\S]*?<\/nav>/);
  assert.ok(match, "Business Owner navigation should exist");
  return match[0];
}

test("every Business Owner navigation exposes one separate public Customer Experience destination", function () {
  for (const file of ownerPages) {
    const navigation = ownerNavigation(read(file));
    const links = Array.from(navigation.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g));
    const customerLinks = links.filter((link) => /Customer Experience/.test(link[2]));
    assert.equal(customerLinks.length, 1, `${file} should contain one Customer Experience link`);
    assert.match(customerLinks[0][1], /class="owner-public-destination"/);
    assert.match(customerLinks[0][1], /href="customer\.html"/);
    assert.doesNotMatch(customerLinks[0][1], /data-owner-section|aria-current|\?/);
    assert.doesNotMatch(customerLinks[0][0], /businessId|ownerId|clerk|campaignId|identity=|localStorage/i);

    const ownerSections = links.filter((link) => /data-owner-section/.test(link[1]));
    assert.deepEqual(ownerSections.map((link) => link[1].match(/data-owner-section="([^"]+)"/)[1]),
      ["overview", "business-profile", "recommends", "marketing", "results"]);
  }
});

test("Business Owner Overview provides a privacy-safe public-entry action below Current work", function () {
  const html = read("business-workspace.html");
  const currentWork = html.indexOf('class="owner-current-work"');
  const publicCard = html.indexOf('class="owner-customer-experience-card"');
  assert.ok(currentWork >= 0 && publicCard > currentWork);
  assert.match(html.slice(publicCard), /<h3 id="customer-experience-heading">Customer Experience<\/h3>/);
  assert.match(html.slice(publicCard), /See the public experience where customers discover approved work from DEMEOS businesses\./);
  assert.match(html.slice(publicCard), /href="customer\.html">Open Customer Experience<\/a>/);
  assert.doesNotMatch(html.slice(publicCard), /customer\.html\?|businessId|ownerId|campaignId/);
});

test("Customer Experience has its clear public identity without an owner authentication boundary", function () {
  const html = read("customer.html");
  assert.match(html, /<p class="customer-eyebrow">DEMEOS Customer Interface<\/p>/);
  assert.match(html, /<h1 id="customer-title">A clearer way to discover what businesses share<\/h1>/);
  assert.match(html, /Explore approved public work, understand its context/);
  assert.doesNotMatch(html, /owner-auth|owner-sign-in|business-workspace\.js|clerk/i);
  assert.match(html, /<script src="js\/customer\.js"><\/script>/);
});

test("public customer requests retain the minimized server-authoritative contract", function () {
  const source = read("js/customer.js");
  assert.match(source, /fetcher\("\/api\/customer\/work"\)/);
  assert.match(source, /Array\.isArray\(data\.customerPackages\)/);
  assert.match(source, /`\/api\/customer\/work\/\$\{encodeURIComponent\(work\.workItemId\)\}\/participation`/);
  assert.match(source, /body: JSON\.stringify\(\{ action: work\.participationAction \}\)/);
  assert.doesNotMatch(source, /businessId|ownerId|campaignId|localStorage/);
  assert.match(source, /Nothing to discover just yet/);
  assert.match(source, /DEMEOS could not load approved work\. Please try again\./);
  assert.doesNotMatch(source, /localStorage|URLSearchParams|location\.search/);
});
