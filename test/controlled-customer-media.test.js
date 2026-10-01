const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { productExperienceTestContent } = require("../api/_lib/controlled-customer-test-content.js");
const { getValidPublicCustomerWork } = require("../api/_lib/customer-public-work-contract.js");
const { pauseExperienceVideos } = require("../js/customer-product-experience.js");
test("supplied test media keeps exact product relationships and nature marketing stays view-only", () => {
  const work = getValidPublicCustomerWork(productExperienceTestContent());
  assert.equal(work.length, 5);
  let images = 0, videos = 0;
  for (const item of work) {
    assert.match(item.businessName, /^DEMEOS Test /);
    for (const asset of item.media) {
      const path = new URL(asset.deliveryUrl).pathname.slice(1);
      assert.ok(fs.existsSync(path), path);
      if (asset.kind === "image") images++; else videos++;
      if (asset.purpose === "product") {
        const product = item.products.find(p => p.productId === asset.relatedEntityId);
        assert.ok(product, "A product image must belong to this test business");
        assert.equal(product.imageUrl, asset.deliveryUrl);
      } else {
        assert.equal(asset.relatedEntityId, undefined);
        assert.equal(item.products, undefined);
      }
    }
  }
  assert.equal(images, 9);
  assert.equal(videos, 1);
  assert.match(work[4].media[0].deliveryUrl, /media\/controlled\/customer-outdoor-video\.mp4$/);
  assert.equal(work[4].customerContinuation, undefined);
});
test("leaving Product Experience pauses mounted videos", () => {
  let paused = 0;
  pauseExperienceVideos({ querySelectorAll(selector) { assert.equal(selector, "#discover video, #product-experience video"); return [{ pause() { paused++; } }, { pause() { paused++; } }]; } });
  assert.equal(paused, 2);
});
