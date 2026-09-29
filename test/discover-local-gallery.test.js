const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { discoverTestContent } = require("../api/customer/work.js");

test("controlled Discover gallery images are local and clearly labelled", () => {
 const work = discoverTestContent();
 assert.equal(work.length, 3);
 for (const item of work) for (const media of item.media.filter(asset => asset.kind === "image")) {
  assert.match(media.deliveryUrl, /^https:\/\/www\.demeos\.io\/images\/discover-test-(bistro|studio|market)-(gallery|view-only)\.svg$/);
  const file = path.join(__dirname, "..", "images", new URL(media.deliveryUrl).pathname.split("/").pop());
  const svg = fs.readFileSync(file, "utf8");
  assert.match(svg, /viewBox="0 0 1200 675"/);
  assert.match(svg, /CONTROLLED TEST/);
 }
});

test("bistro view-only media is visually distinct and has no product match", () => {
 const bistro = discoverTestContent().find(item => item.businessName && /bistro/i.test(item.businessName));
 assert.ok(bistro);
 const primary = bistro.media.find(asset => asset.assetId === "test-bistro-image");
 const viewOnly = bistro.media.find(asset => asset.assetId === "test-bistro-view-only");
 assert.ok(primary && viewOnly);
 assert.notEqual(primary.deliveryUrl, viewOnly.deliveryUrl);
 assert.equal(viewOnly.productId, undefined);
});
