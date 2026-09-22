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


test("business media can be linked to brand purpose and related business entities", function () {
  const asset = normalizeMediaAsset({
    assetId: "brand-1", businessId: "business-a", kind: "image", state: "ready",
    purpose: "brand", brandReference: "primary-brand", relatedEntityId: "product-1",
    contentType: "image/webp", sizeBytes: 1048576, width: 1600, height: 900,
    deliveryUrl: "https://media.example/brand.webp"
  }, "business-a");
  assert.equal(asset.purpose, "brand");
  assert.equal(asset.brandReference, "primary-brand");
  assert.equal(asset.relatedEntityId, "product-1");
});

test("image upload policy accepts JPEG PNG and WebP up to 15 MB", function () {
  for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.ok(normalizeMediaAsset({ assetId: contentType, businessId: "business-a", kind: "image", state: "pending-upload", contentType, sizeBytes: 15 * 1024 * 1024 }, "business-a"));
  }
  assert.equal(normalizeMediaAsset({ assetId: "large", businessId: "business-a", kind: "image", state: "pending-upload", contentType: "image/jpeg", sizeBytes: 15 * 1024 * 1024 + 1 }, "business-a"), null);
});

test("video upload policy accepts MP4 and MOV sources up to 60 seconds", function () {
  for (const contentType of ["video/mp4", "video/quicktime"]) {
    assert.ok(normalizeMediaAsset({ assetId: contentType, businessId: "business-a", kind: "video", state: "processing", contentType, durationSeconds: 60 }, "business-a"));
  }
  assert.equal(normalizeMediaAsset({ assetId: "long", businessId: "business-a", kind: "video", state: "processing", contentType: "video/mp4", durationSeconds: 61 }, "business-a"), null);
});

test("media guidance recommends strong image originals and 15 to 30 second marketing videos", function () {
  const { getMediaGuidance } = require("../api/_lib/media-asset-contract.js");
  assert.match(getMediaGuidance({ kind: "image", width: 800 })[0], /1200 pixels/);
  assert.match(getMediaGuidance({ kind: "video", durationSeconds: 45 })[0], /15 to 30 second/);
  assert.deepEqual(getMediaGuidance({ kind: "video", durationSeconds: 20 }), []);
});


test("public media preserves only its validated business entity relationship", function () {
  const asset = toPublicMediaAsset({
    assetId: "product-media-1", businessId: "business-a", kind: "image", state: "ready",
    purpose: "product", relatedEntityId: "product-1", deliveryUrl: "https://media.example/product.webp"
  }, "business-a");
  assert.equal(asset.purpose, "product");
  assert.equal(asset.relatedEntityId, "product-1");
  assert.equal(Object.hasOwn(asset, "businessId"), false);
  assert.equal(Object.hasOwn(asset, "storageKey"), false);
});
