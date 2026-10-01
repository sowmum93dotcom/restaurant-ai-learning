const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { productExperienceTestContent: fixtures } = require('../api/_lib/controlled-customer-test-content.js');
const { getValidPublicCustomerWork } = require('../api/_lib/customer-public-work-contract.js');

test('supplied controlled media has exact business/product ownership and all 13 assets survive validation', () => {
  const raw = fixtures();
  const publicWork = getValidPublicCustomerWork(raw);
  assert.equal(publicWork.length, 6);
  const mediaIds = new Set();
  for (const work of raw) {
    assert.match(work.businessId, /^test-business-/);
    assert.match(work.businessName, /^DEMEOS Test /);
    for (const media of work.media) {
      assert.ok(!mediaIds.has(media.assetId));
      mediaIds.add(media.assetId);
      const file = path.join(__dirname, '..', new URL(media.deliveryUrl).pathname);
      assert.ok(fs.statSync(file).size > 0, media.assetId + ' has a non-empty local asset');
      if (media.purpose === 'product') {
        const product = work.products.find(p => p.productId === media.relatedEntityId);
        assert.ok(product, 'media links only to its own business product');
        assert.equal(product.businessId, work.businessId);
        assert.equal(product.imageUrl, media.deliveryUrl);
        assert.ok(work.customerContinuation.routes.includes(product.continuationRoute));
        assert.equal(new URL(work.customerContinuation[product.continuationRoute === 'booking' ? 'bookingLink' : 'website']).hostname, 'www.demeos.io');
      }
    }
  }
  assert.equal(mediaIds.size, 13);
  assert.equal(publicWork.flatMap(w => w.media).length, 13);
  const garden = publicWork.find(w => w.workItemId === 'test-discover-garden');
  assert.equal(garden.media[0].kind, 'video');
  assert.equal(garden.media[0].contentType, 'video/mp4');
  assert.equal(garden.products, undefined);
  assert.equal(garden.customerContinuation, undefined);
});

test('controlled content can be disabled while the exact query/header gate stays intact', () => {
  const { isDiscoverTestMode } = require('../api/customer/work.js');
  const request = { query: { 'demeos-test': '1' }, headers: { 'x-demeos-test-mode': 'controlled-preview' } };
  const previous = process.env.DEMEOS_CONTROLLED_TEST_CONTENT;
  try {
    delete process.env.DEMEOS_CONTROLLED_TEST_CONTENT;
    assert.equal(isDiscoverTestMode(request), true);
    assert.equal(isDiscoverTestMode({ query: request.query, headers: {} }), false);
    process.env.DEMEOS_CONTROLLED_TEST_CONTENT = 'disabled';
    assert.equal(isDiscoverTestMode(request), false);
    assert.equal(isDiscoverTestMode({ query: request.query, headers: { 'x-demeos-discover-test': 'controlled-preview' } }), false);
  } finally {
    if (previous === undefined) delete process.env.DEMEOS_CONTROLLED_TEST_CONTENT;
    else process.env.DEMEOS_CONTROLLED_TEST_CONTENT = previous;
  }
});

test('video fallback is validated on server and client without changing ownership', () => {
  const { toCustomerWorkItem } = require('../js/customer.js');
  const videoWork = fixtures().find(w => w.workItemId === 'test-discover-garden');
  for (const normalize of [w => getValidPublicCustomerWork([w])[0], toCustomerWorkItem]) {
    const accepted = normalize(videoWork);
    assert.equal(accepted.media[0].fallbackSource.contentType, 'video/webm');
    assert.match(accepted.media[0].fallbackSource.deliveryUrl, /^https:\/\/www\.demeos\.io\/images\/controlled-test\/garden-wildlife\.webm$/);
    for (const source of [{deliveryUrl:'javascript:alert(1)',contentType:'video/webm'},{deliveryUrl:'https://www.demeos.io/video',contentType:'text/html'}]) {
      const rejected = normalize({...videoWork,media:[{...videoWork.media[0],fallbackSource:source}]});
      assert.equal(rejected.media[0].fallbackSource, undefined);
      assert.equal(rejected.media[0].assetId,videoWork.media[0].assetId);
    }
  }
});
