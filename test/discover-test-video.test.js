const test = require("node:test");
const assert = require("node:assert/strict");
const { discoverTestContent } = require("../api/customer/work.js");
const { getValidPublicCustomerWork } = require("../api/_lib/customer-public-work-contract.js");

test("controlled Discover restores the original view-only Studio video", function () {
  const work = getValidPublicCustomerWork(discoverTestContent());
  const studio = work.find(function (item) { return item.workItemId === "test-discover-studio"; });
  assert.ok(studio);
  const video = studio.media.find(function (asset) { return asset.assetId === "test-studio-video"; });
  assert.deepEqual({ kind: video.kind, role: video.role, purpose: video.purpose, deliveryUrl: video.deliveryUrl }, {
    kind: "video", role: "supporting", purpose: "business",
    deliveryUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
  });
  assert.equal(video.relatedEntityId, undefined);
});
