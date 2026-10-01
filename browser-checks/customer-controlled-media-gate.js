const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { productExperienceTestContent: fixtures } = require('../api/_lib/controlled-customer-test-content');
const { getValidPublicCustomerWork } = require('../api/_lib/customer-public-work-contract');
const base = process.env.DEMEOS_BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const local = base.includes('127.0.0.1');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]) {
   const page = await browser.newPage({viewport});
   const errors=[];page.on('pageerror', e=>errors.push(String(e)));
   if(local) {
    await page.route('**/api/customer/work?demeos-test=1', route=>{
     const request=route.request();assert.equal(request.headers()['x-demeos-test-mode'],'controlled-preview');
     return route.fulfill({json:{work:getValidPublicCustomerWork(fixtures()),customerPackages:[],testMode:true}});
    });
    await page.route('https://www.demeos.io/images/controlled-test/**', route=>route.fulfill({path:path.join(__dirname,'..',new URL(route.request().url()).pathname)}));
   }
   await page.goto(base+'/customer.html?demeos-test=1#discover',{waitUntil:'networkidle'});
   await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor();
   assert.equal(await page.locator('.customer-work-card').count(),6);
   assert.equal(await page.locator('.customer-header-inner').evaluate(el=>getComputedStyle(el,'::after').content),'none','header keeps navigation unobstructed');
   assert.match(await page.locator('#customer-work-status').innerText(),/CONTROLLED TEST CONTENT/);
   const imageMetrics=await page.locator('#customer-work-list img').evaluateAll(async images=>{
    images.forEach(im=>{im.loading="eager";});
    await Promise.race([Promise.all(images.map(im=>im.decode())),new Promise((_,reject)=>setTimeout(()=>reject(new Error("image decoding timeout")),15000))]);
    return images.map(im=>({w:im.getBoundingClientRect().width,h:im.getBoundingClientRect().height,nw:im.naturalWidth,nh:im.naturalHeight,fit:getComputedStyle(im).objectFit,cls:im.className}));
   });
   assert.equal(imageMetrics.length,23);
   for (const im of imageMetrics) { assert.ok(im.nw>0);assert.equal(im.fit,'contain', im.cls);assert.ok(Math.abs(im.w/im.h-im.nw/im.nh)<.015,'natural aspect ratio preserved '+JSON.stringify(im)); }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
   for (const work of fixtures().filter(w=>w.products)) {
    const card=page.locator('.customer-work-card').filter({hasText:work.businessName});
    for (const product of work.products) {
     const option=card.locator('[data-product-id="'+product.productId+'"]');
     await option.locator('.customer-product-continue-action').click();
     await page.locator('#product-experience:not([hidden])').waitFor();
     assert.equal(await page.locator('#product-experience-title').innerText(),product.name);
     assert.equal(await page.locator('#product-experience-business').textContent(),work.businessName);
     assert.equal(await page.locator('#product-experience-image').getAttribute('src'),product.imageUrl);
     assert.equal(await page.locator('#product-experience-action').getAttribute('href'),work.customerContinuation[product.continuationRoute==='booking'?'bookingLink':'website']);
     assert.equal(await page.locator('#product-experience-action').innerText(),product.continuationRoute==='booking'?'Book with business':'Where to buy');
     await page.locator('#product-experience-back').click();
    }
   }
   const video=page.locator('video');await video.scrollIntoViewIfNeeded();
   await video.evaluate(v=>{v.load();});
   try { await page.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:10000}); } catch(e) { console.error(await video.evaluate(v=>({error:v.error&&{code:v.error.code,message:v.error.message},state:v.readyState,src:v.currentSrc,h264:v.canPlayType('video/mp4; codecs="avc1.42E01E"')}))); throw e; }
   const playback=await video.evaluate(async v=>{await v.play();return {width:v.videoWidth,height:v.videoHeight,inline:v.playsInline,controls:v.controls,duration:v.duration};});
   assert.equal(playback.width,540);assert.equal(playback.height,960);assert.ok(playback.duration>64);assert.ok(playback.inline&&playback.controls);
   await page.waitForFunction(()=>document.querySelector('video').currentTime>.2);
   await page.locator('.customer-discover-option a').first().click();
   assert.ok(await video.evaluate(v=>v.paused), 'Product Experience pauses mounted video');
   await page.locator('#product-experience-back').click();
   const garden=page.locator('.customer-work-card').filter({hasText:'DEMEOS Test Garden and Wildlife'});
   assert.equal(await garden.locator('.customer-product-continue-action').count(),0);
   await page.screenshot({path:'/tmp/demeos-controlled-'+viewport.width+'.png',fullPage:true});
   assert.deepEqual(errors,[]);
   console.log('Controlled media and continuation verified at '+viewport.width+'px');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
