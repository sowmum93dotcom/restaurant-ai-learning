const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { discoverTestContent } = require("../api/customer/work.js");

test("controlled Discover gallery images are local and clearly labelled", () => {
 const work = discoverTestContent();
 assert.equal(work.length, 3);
 for (const item of work) for (const media of item.media.filter(asset => asset.kind === "image")) {
  assert.match(media.deliveryUrl, /^https:\/\/www\.demeos\.io\/images\/discover-test-(bistro|studio|market)-gallery\.svg$/);
  const file = path.join(__dirname, "..", "images", new URL(media.deliveryUrl).pathname.split("/").pop());
  const svg = fs.readFileSync(file, "utf8");
  assert.match(svg, /viewBox="0 0 1200 675"/);
  assert.match(svg, /CONTROLLED TEST/);
 }
});
