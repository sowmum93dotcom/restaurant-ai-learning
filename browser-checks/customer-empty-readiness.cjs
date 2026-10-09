'use strict';
const assert = require('node:assert/strict');
const {LOCALES} = require('../api/_lib/customer-evidence-provenance');
const {buildCustomerUnderstanding, confirmCustomerUnderstanding} = require('../js/customer-understanding');
const VIEWPORTS = [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}];

// Read-only public journey. Empty is an explicit expectation, never inferred
// from an error response, and never filled with controlled examples.
async function verifyEmptyReadiness(context, base) {
  const feed = await context.request.get(base+'/api/customer/work');
  assert.equal(feed.status(),200);
  assert.match(feed.headers()['cache-control'],/private.*no-store/);
  const body = await feed.json();
  assert.deepEqual(body.work,[]);
  assert.equal(body.testMode,false);
  const queryOnly = await context.request.get(base+'/api/customer/work?demeos-test=1');
  assert.equal(queryOnly.status(),200);
  assert.deepEqual((await queryOnly.json()).work,[]);
  assert.equal((await queryOnly.json()).testMode,false);
  const invalid = await context.request.post(base+'/api/customer/possibilities',{data:{}});
  assert.equal(invalid.status(),400);
  const confirmed = confirmCustomerUnderstanding(buildCustomerUnderstanding('','Fashion and Apparel Commerce black waterproof jacket under £100'));
  for (const locale of LOCALES) {
    const response = await context.request.post(base+'/api/customer/possibilities',{
      data:{understanding:confirmed},headers:{'x-demeos-customer-locale':locale}
    });
    assert.equal(response.status(),200);
    assert.match(response.headers()['cache-control'],/private.*no-store/);
    assert.deepEqual(await response.json(),{possibilities:[]});
  }
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  try {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const locale of LOCALES) {
        // Reset the existing remembered journey stage before a new request.
        await page.goto(base+'/index.html');
        await page.goto(base+'/customer.html#intention');
        await page.locator('#customer-language').selectOption(locale);
        assert.equal(await page.locator('html').getAttribute('lang'),locale);
        assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');
        await page.locator('#customer-intention-text').fill('Fashion and Apparel Commerce black waterproof jacket under £100');
        await page.locator('#customer-intention-form button[type="submit"]').click();
        const response = page.waitForResponse(r=>new URL(r.url()).pathname==='/api/customer/possibilities'&&r.request().method()==='POST');
        await page.locator('#customer-understanding-confirm').click();
        const delivered = await response;
        assert.equal(delivered.status(),200);
        assert.deepEqual(await delivered.json(),{possibilities:[]});
        await page.locator('#customer-no-possibilities:not([hidden])').waitFor();
        assert.equal(await page.locator('#customer-possibilities-list .customer-possibility-surface').count(),0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow: '+locale+'/'+viewport.width);
      }
      await page.goto(base+'/my-demeos.html');
      for (const locale of LOCALES) {
        await page.locator('#customer-language').selectOption(locale);
        assert.equal(await page.locator('#use-preferences-as-guidance').count(),1);
        assert.equal(await page.locator('#use-feedback-as-guidance').count(),1);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      await page.locator('.customer-journey-nav a').first().click();
      await page.locator('#customer-work-list[data-controlled-test="false"]').waitFor({state:'attached'});
      assert.equal(await page.locator('.customer-work-card').count(),0);
      console.log('Empty catalogue: nine language journeys passed',viewport.width);
    }
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
}
module.exports = {verifyEmptyReadiness};
