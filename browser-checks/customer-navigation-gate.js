/* Exercise actual links and browser history across the permanent customer pages. */
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { productExperienceTestContent } = require('../api/_lib/controlled-customer-test-content');
const { getValidPublicCustomerWork } = require('../api/_lib/customer-public-work-contract');
const work = getValidPublicCustomerWork(productExperienceTestContent());
const base = process.env.DEMEOS_BROWSER_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 1000 }]) {
   const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
   page.on('pageerror', error => errors.push(String(error)));
   await context.route('**/api/customer/work*', route => {
    const request = route.request(), controlled = new URL(request.url()).searchParams.get('demeos-test') === '1';
    assert.equal(controlled, request.headers()['x-demeos-test-mode'] === 'controlled-preview');
    return route.fulfill({ json: { work: controlled ? work : [], testMode: controlled, customerPackages: [] } });
   });
   await context.route('**/api/public-config', route => route.fulfill({ status: 503, json: { reason: 'unavailable' } }));
   await context.route('**/api/customer/preparation*', route => route.fulfill({ status: 401, json: { reason: 'signed-out' } }));
   async function discover(controlled = true) {
    await page.locator('#discover:not([hidden]) #customer-work-list[data-controlled-test="' + controlled + '"]').waitFor({state:'attached'});
    assert.equal(await page.locator('.customer-work-card').count(), controlled ? 6 : 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
   }
   async function product() {
    await page.locator('#product-experience:not([hidden])[data-product-id="test-product-activewear"]').waitFor();
    assert.equal(new URL(page.url()).hash, '#product-experience');
    assert.equal(new URL(page.url()).searchParams.get('product'), 'test-product-activewear');
    assert.equal(new URL(page.url()).searchParams.get('work'), 'test-discover-fashion');
    assert.equal(await page.locator('#discover').isVisible(), false);
   }
   async function choices() {
    assert.equal(await page.locator('select[data-option-key="size"]').inputValue(), 'large');
    assert.equal(await page.locator('select[data-option-key="colour"]').inputValue(), 'blue');
    assert.equal(await page.locator('#purchase-preparation-quantity input').inputValue(), '2');
   }
   await page.goto(base + '/index.html'); await page.locator('#customer-entry-link').click(); await discover();
   await page.locator('[data-product-id="test-product-activewear"] .customer-product-continue-action').click(); await product();
   await page.locator('select[data-option-key="size"]').selectOption('large');
   await page.locator('select[data-option-key="colour"]').selectOption('blue');
   await page.locator('#purchase-preparation-quantity input').fill('2');
   await page.locator('#product-experience-title').click(); // Let input observers finish.
   await page.reload(); await product(); await choices();
   await page.locator('.customer-journey-nav a[href="#discover"]').click(); await discover();
   await page.goBack(); await product(); await choices();
   await page.goForward(); await discover();
   await page.goBack(); await product();
   await page.locator('.customer-journey-nav a[href="#intention"]').click();
   await page.locator('#intention:not([hidden])').waitFor();
   assert.equal(await page.locator('#product-experience').isVisible(), false);
   await page.goBack(); await product(); await choices();
   await page.locator('#product-experience-action').click();
   await page.locator('#purchase-auth-selection').waitFor({ state: 'visible' });
   assert.match(await page.locator('#purchase-auth-selection').textContent(), /Quantity: 2/);
   await page.locator('#purchase-auth-return').click(); await product(); await choices();
   await page.locator('.customer-journey-nav a').last().click(); await page.waitForLoadState('load');
   await page.locator('#open-my-intentions').click(); assert.equal(new URL(page.url()).hash, '#my-intentions');
   await page.locator('#my-intentions:not([hidden])').waitFor();
   await page.locator('#my-intentions [data-relationship-back]').click();
   await page.locator('#my-demeos-overview:not([hidden])').waitFor();
   await page.goBack(); await page.locator('#my-intentions:not([hidden])').waitFor();
   await page.reload(); await page.locator('#my-intentions:not([hidden])').waitFor();
   await page.locator('.customer-journey-nav a').first().click(); await discover();
   await page.locator('.customer-brand').click(); assert.equal(new URL(page.url()).pathname, '/index.html');
   await page.locator('#customer-entry-link').click(); await discover();
   await page.locator('.demeos-public-footer-links a').first().click();
   await page.locator('a[data-public-copy="controls"]').click(); await page.waitForLoadState('load');
   await page.locator('#privacy-control:not([hidden])').waitFor();
   await page.locator('.customer-journey-nav a').first().click(); await discover();
   // Old public/preview bookmarks use the same populated main page.
   await page.goto(base + '/customer.html?demeos-test=0#discover'); await discover();
   assert.equal(new URL(page.url()).searchParams.has('demeos-test'), false);
   assert.equal(await page.locator('#customer-controlled-test-exit').isVisible(), false);
   await page.locator('.customer-brand').click(); await page.locator('#customer-entry-link').click(); await discover();
   await page.goto(base + '/customer.html?demeos-test=1&work=test-discover-fashion&product=missing#product-experience');
   await discover(); assert.equal(new URL(page.url()).hash, '#discover');
   assert.equal(await page.locator('#product-experience').isVisible(), false);
   assert.deepEqual(errors, []);
   console.log('Customer navigation gate passed', viewport.width, 'product address, exact reload/history selections, Buy return, account sections, homepage re-entry and information links');
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
