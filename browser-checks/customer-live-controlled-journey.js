'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
// Only a protected PR preview may use this check. Production uses the separate
// genuine-only readiness gate. No real login, purchase or external action.
(async()=>{
 let input='';for await(const chunk of process.stdin)input+=chunk;
 const config=JSON.parse(input),origin=new URL(config.url);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.vercel.app')||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||config.controlledPreview!==true)throw Error('An explicit Vercel preview origin is required');
 const browser=await chromium.launch({headless:true,...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce',ignoreHTTPSErrors:process.env.DEMEOS_BROWSER_IGNORE_HTTPS_ERRORS==='1'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   if(config.share)await page.goto(origin.origin+'/?_vercel_share='+encodeURIComponent(config.share));
   const feed=await context.request.get(origin.origin+'/api/customer/work?demeos-test=1',{headers:{'x-demeos-test-mode':'controlled-preview'}});
   assert.equal(feed.status(),200);const data=await feed.json();assert.equal(data.testMode,true);assert.equal(data.work.length,6);
   const ordinary=await context.request.get(origin.origin+'/api/customer/work');assert.equal(ordinary.status(),200);assert.equal((await ordinary.json()).testMode,false);
   await page.goto(origin.origin+'/index.html');await page.locator('#customer-entry-link').click();
   await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.customer-work-card').count(),6);
   assert.ok(await page.locator('#customer-work-status').innerText());
   const media=page.locator('.customer-work-card video').first();assert.ok(await media.count());assert.equal(await media.getAttribute('playsinline'),'');
   for(const locale of LOCALES){
    await page.locator('#customer-language').selectOption(locale);
    await page.locator('[data-product-id="test-product-activewear"] .customer-product-continue-action').click();
    await page.locator('#product-experience:not([hidden])').waitFor();
    await page.locator('select[data-option-key="size"]').selectOption('large');await page.locator('select[data-option-key="colour"]').selectOption('blue');
    assert.equal(await page.locator('#product-experience-action').getAttribute('href'),'#purchase-preparation');
    assert.equal(await page.locator('#product-experience-action').getAttribute('aria-disabled'),null);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#product-experience-back').click();
    assert.equal(new URL(page.url()).hash,'#discover');
   }
   await page.locator('#customer-language').selectOption('en');
   await page.locator('.customer-journey-nav a[href="#intention"]').click();
   await page.locator('#customer-intention-text').fill('jacket');await page.locator('#customer-intention-form button[type="submit"]').click();
   const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/customer/possibilities'&&r.request().method()==='POST');
   await page.locator('#customer-understanding-confirm').click();const result=await response;assert.equal(result.status(),200);assert.equal((await result.json()).testMode,true);
   await page.locator('.customer-possibility-surface').press('Enter');
   await page.locator('#customer-focused-possibility[data-work-item-id="test-discover-fashion"]:not([hidden])').waitFor();
   await page.locator('#customer-focused-possibility [data-product-id="test-product-mens-fashion"] .customer-product-continue-action, #customer-focused-possibility [data-product-id="test-product-mens-fashion"] .customer-item-details').first().click();
   await page.locator('#product-experience:not([hidden])[data-product-id="test-product-mens-fashion"]').waitFor();
   await page.locator('#product-experience-back').click();assert.equal(new URL(page.url()).hash,'#intention');
   await page.locator('.customer-journey-nav a[href="#discover"]').click();
   await page.locator('[data-product-id="test-product-activewear"] .customer-product-continue-action').click();
   await page.locator('select[data-option-key="size"]').selectOption('large');await page.locator('select[data-option-key="colour"]').selectOption('blue');
   await page.locator('#product-experience-action').click();await page.locator('#purchase-auth-selection').waitFor();
   await page.locator('#purchase-auth-return').click();await page.locator('#product-experience:not([hidden])').waitFor();
   assert.equal(await page.locator('select[data-option-key="size"]').inputValue(),'large');assert.equal(await page.locator('select[data-option-key="colour"]').inputValue(),'blue');
   await page.locator('.customer-journey-nav a').last().click();
   for(const locale of LOCALES){
    await page.locator('#customer-language').selectOption(locale);
    assert.equal(await page.locator('#use-preferences-as-guidance').count(),1);
    assert.equal(await page.locator('#use-feedback-as-guidance').count(),1);
   }
   await page.locator('.customer-journey-nav a').first().click();await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor({state:'attached'});
   assert.deepEqual(errors,[]);console.log('Actual controlled preview journey and nine-language products/privacy passed',viewport.width);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e).replace(/_vercel_share=[^\s"']+/g,'_vercel_share=[redacted]'));process.exit(1);});
