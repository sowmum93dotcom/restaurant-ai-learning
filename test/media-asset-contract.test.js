const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMediaAsset, toPublicMediaAsset } = require("../api/_lib/media-asset-contract.js");
test("media asset metadata stays bound to its owning business", function () {
  const asset = normalizeMediaAsset({ assetId: "asset-1", businessId: "business-a", kind: "image", state: "ready", contentType: "image/webp", deliveryUrl: "https://media.example/asset-1.webp" }, "business-a");
  assert.equal(asset.assetId, "asset-1");
  assert.equal(normalizeMediaAsset({ ...asset, businessId: "business-b" }, "business-a"), null);
});
test("only ready assets with controlled HTTPS delivery can become public media", function () {
  const base = { assetId: "asset-1", businessId: "business-a", kind: "image", contentType: "image/webp" };
  assert.equal(toPublicMediaAsset({ ...base, state: "processing", deliveryUrl: "https://media.example/a.webp" }, "business-a"), null);
  assert.equal(toPublicMediaAsset({ ...base, state: "ready", deliveryUrl: "javascript:alert(1)" }, "business-a"), null);
  assert.deepEqual(toPublicMediaAsset({ ...base, state: "ready", deliveryUrl: "https://media.example/a.webp" }, "business-a"), { assetId: "asset-1", kind: "image", deliveryUrl: "https://media.example/a.webp", contentType: "image/webp" });
});
test("media contract supports image and video lifecycle without storing binary data in business records", function () {
  for (const kind of ["image", "video"]) {
    const asset = normalizeMediaAsset({ assetId: kind + "-1", businessId: "business-a", kind, state: "pending-upload" }, "business-a");
    assert.equal(asset.kind, kind); assert.equal(Object.hasOwn(asset, "bytes"), false); assert.equal(Object.hasOwn(asset, "data"), false);
  }
});
