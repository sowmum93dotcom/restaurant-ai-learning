const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { productExperienceTestContent: fixtures } = require('../api/_lib/controlled-customer-test-content');
const { getValidPublicCustomerWork } = require('../api/_lib/customer-public-work-contract');
const base = process.env.DEMEOS_BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const local = base.includes('127.0.0.1');
async function openProduct(page,option,product,work,language='en') {
 assert.equal(await option.locator('a[href^="http"]').count(),0,'structured card cannot bypass selection with an external link');
 await option.locator('.customer-product-continue-action, .customer-item-details').first().click();
 await page.locator('#product-experience:not([hidden])').waitFor();
 const presentation=require('../js/customer-item-contract').normalize(product.presentation);
 const chosen=presentation.variants.find(v=>v.availability==='available'||v.availability==='limited');
 for(const field of presentation.options) {
  const value=chosen?chosen.selection[field.key]:field.values[0].value;
  const select=page.locator('#product-experience-options select[data-option-key="'+field.key+'"]');
  if(await select.isEnabled())await select.selectOption(value);
 }
 const ownedCopy=require('../js/demeos-item-presentation-copy')[language];
 for(const field of presentation.options) {
  assert.equal(await page.locator('#product-experience-options label[data-option-key="'+field.key+'"] span').textContent(),ownedCopy.fields[field.key]);
  for(const choice of field.values.filter(v=>v.copyKey))assert.equal(await page.locator('#product-experience-options select[data-option-key="'+field.key+'"] option[value="'+choice.value+'"]').textContent(),ownedCopy.values[choice.copyKey]);
 }
 const action=page.locator('#product-experience-action');
 const blocked=product.availability==='unavailable';
 if(blocked){assert.equal(await action.getAttribute('href'),null);assert.equal(await action.getAttribute('aria-disabled'),'true');}
 else if(product.continuationRoute==='demeos'){assert.equal(await action.getAttribute('href'),'#purchase-preparation');assert.equal(await action.getAttribute('aria-disabled'),null);assert.equal(await action.textContent(),require('../js/demeos-item-presentation-copy')[language].buyDemeos);}
 else {
  assert.equal(await action.getAttribute('href'),work.customerContinuation[product.continuationRoute==='booking'?'bookingLink':'website']);
  const c=require('../js/demeos-controlled-customer-copy')[language];
  assert.equal(await action.textContent(),product.continuationRoute==='booking'?c.book:c.buy);
 }
}

(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]) {
   const page = await browser.newPage({viewport});
   const errors=[];page.on('pageerror', e=>errors.push(String(e)));
   if(local) {
    await page.route('**/api/customer/work', route=>route.fulfill({json:{work:[],customerPackages:[],testMode:false}}));
    await page.route('**/api/customer/work?demeos-test=1', route=>{
     const request=route.request();assert.equal(request.headers()['x-demeos-test-mode'],'controlled-preview');
     return route.fulfill({json:{work:getValidPublicCustomerWork(fixtures()),customerPackages:[],testMode:true}});
    });
    await page.route('https://www.demeos.io/images/controlled-test/**', route=>route.fulfill({path:path.join(__dirname,'..',new URL(route.request().url()).pathname)}));
   }
   console.log('Opening',viewport.width);await page.goto(base+'/customer.html?demeos-test=1#discover',{waitUntil:'networkidle'});
   await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor();
   assert.equal(await page.locator('.customer-work-card').count(),6);
   assert.equal(await page.locator('.customer-header-inner').evaluate(el=>getComputedStyle(el,'::after').content),'none','header keeps navigation unobstructed');
   assert.match(await page.locator('#customer-work-status').textContent(),/CONTROLLED TEST CONTENT/);
   const imageMetrics=await page.locator('#customer-work-list img').evaluateAll(async images=>{
    images.forEach(im=>{im.loading="eager";});
    await Promise.race([Promise.all(images.map(im=>im.decode())),new Promise((_,reject)=>setTimeout(()=>reject(new Error("image decoding timeout")),15000))]);
    return images.map(im=>({w:im.getBoundingClientRect().width,h:im.getBoundingClientRect().height,nw:im.naturalWidth,nh:im.naturalHeight,fit:getComputedStyle(im).objectFit,cls:im.className}));
   });
   console.log('Images decoded');assert.equal(imageMetrics.length,23);
   for (const im of imageMetrics) { assert.ok(im.nw>0);assert.equal(im.fit,'contain', im.cls);assert.ok(Math.abs(im.w/im.h-im.nw/im.nh)<.015,'natural aspect ratio preserved '+JSON.stringify(im)); }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
   for (const work of fixtures().filter(w=>w.products)) {
    const card=page.locator('.customer-work-card').filter({hasText:work.businessName});
    for (const product of work.products) {
     const option=card.locator('[data-product-id="'+product.productId+'"]');
     console.log('Product',product.productId);await openProduct(page,option,product,work);
     await page.locator('#product-experience:not([hidden])').waitFor();
     assert.equal(await page.locator('#product-experience-title').textContent(),product.name);
     assert.equal(await page.locator('#product-experience-business').textContent(),work.businessName);
     if(product.imageUrl)assert.equal(await page.locator('#product-experience-image').getAttribute('src'),product.imageUrl);

     await page.locator('#product-experience-back').click();
    }
   }
   const activeOption=page.locator('[data-product-id="test-product-activewear"]');
   await openProduct(page,activeOption,fixtures()[0].products[0],fixtures()[0]);
   await page.screenshot({path:'/tmp/demeos-structured-'+viewport.width+'.png',fullPage:true});
   await page.selectOption('#product-experience-options select[data-option-key="size"]','medium');
   await page.selectOption('#product-experience-options select[data-option-key="colour"]','black');
   assert.equal(await page.locator('#product-experience-action').getAttribute('href'),null,'unavailable variant cannot continue');
   assert.equal(await page.locator('#product-experience').getAttribute('data-selected-availability'),'unavailable');
   await page.selectOption('#product-experience-options select[data-option-key="size"]','small');
   await page.selectOption('#product-experience-options select[data-option-key="colour"]','blue');
   assert.equal(await page.locator('#product-experience').getAttribute('data-selected-availability'),'limited');
   assert.match(await page.locator('#product-experience-price').textContent(),/47/);
   await page.locator('#product-experience-back').click();
   await openProduct(page,page.locator('[data-product-id="test-product-running"]'),fixtures()[2].products[0],fixtures()[2]);
   assert.equal(await page.locator('#product-experience-options select[data-option-key="size"]').count(),0,'services never force clothing sizes');
   await page.selectOption('#product-experience-options select[data-option-key="duration"]','minutes60');
   await page.selectOption('#product-experience-options select[data-option-key="people"]','twoPeople');
   assert.equal(await page.locator('#product-experience-action').getAttribute('href'),null,'missing combination cannot continue');
   await page.locator('#product-experience-back').click();
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
   const copy=require('../js/demeos-controlled-customer-copy');
   const cards=page.locator('.customer-work-card');
   await cards.first().focus();await page.keyboard.press('ArrowDown');
   assert.ok(await cards.nth(1).evaluate(n=>n===document.activeElement),'Down advances business');
   await page.keyboard.press('ArrowUp');
   assert.ok(await cards.first().evaluate(n=>n===document.activeElement),'Up returns business');
   const media=cards.first().locator('.customer-work-media');
   await media.focus();await page.keyboard.press('ArrowRight');
   await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='2');
   await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='1');
   for (const code of Object.keys(copy)) {
    console.log('Language',code);const c=copy[code];await page.selectOption('#customer-language',code);
    await page.waitForFunction(b=>document.querySelector('#customer-work-status').textContent===b,c.banner);
    assert.equal(await page.locator('html').getAttribute('dir'),code==='ar'?'rtl':'ltr');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow in '+code);
    await page.evaluate(()=>{
     window.__counterChanges=[];
     window.__counterObserver=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>window.__counterChanges.push(n.textContent))));
     window.__counterObserver.observe(document.querySelector('.customer-media-position'),{childList:true});
    });
    await media.focus();await page.keyboard.press('Home');
    await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='1');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='2');
    assert.equal(await cards.first().locator('.customer-media-position').textContent(),c.media.replace('{index}','2').replace('{count}','3'));
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='1');
    await cards.first().focus();await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='2');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(()=>document.querySelector('.customer-media-position').getAttribute('data-media-index')==='1');
    const announcements=await page.evaluate(()=>{window.__counterObserver.disconnect();return window.__counterChanges;});
    if(code!=="en") assert.ok(announcements.every(text=>!/^Media \d+ of \d+$/.test(text)),"counter never announces English while scrolling in "+code);
    const firstName=await cards.first().locator('.customer-business-name').textContent();
    assert.equal(await media.getAttribute('aria-label'),c.galleryGuidance.replace('{business}',firstName));
    assert.equal(await cards.first().locator('.customer-package-region').getAttribute('aria-label'),c.productsFrom.replace('{business}',firstName));
    for (const [i,work] of fixtures().entries()) {
     const card=cards.nth(i);
     const name=code==='en'?work.businessName:'DEMEOS '+c.test+' '+c.categories[i];
     assert.equal(await card.locator('.customer-business-name').textContent(),name);
     assert.equal(await card.locator('.customer-approved-mark').textContent(),c.approved);
     assert.equal(await card.locator('.customer-choice-title').textContent(),c.choice);
     assert.equal(await card.locator('.customer-participation-button').textContent(),c.tell);
     if(code!=='en') assert.ok(!(await card.locator('.customer-work-content').textContent()).includes('Supplied test media'));
     for(const product of work.products||[]) {
      const option=card.locator('[data-product-id="'+product.productId+'"]');
      const expected=await option.locator('.customer-discover-option-name').textContent();
      if(code!=='en') {
       const pi=['activewear','summer-fashion','mens-fashion','running','football','fishing','camping','hiking','childrens-fashion','toys','childrens-collection','grocery-pack'].indexOf(product.productId.replace('test-product-',''));
       assert.equal(expected,c.test+' '+c.products[pi],'localized product name');
      }
      await openProduct(page,option,product,work,code);
      assert.equal(await page.locator('#product-experience-title').textContent(),expected);
      assert.equal(await page.locator('#product-experience-business').textContent(),name);

      assert.equal(await page.locator('#product-experience-safety').textContent(),c.safety);
      await page.locator('#product-experience-back').click();
     }
    }
    // Switching language while Product Experience is already open also updates its owned content.
    await openProduct(page,cards.first().locator('[data-product-id="test-product-activewear"]'),fixtures()[0].products[0],fixtures()[0],code);
    const next=code==='ja'?'en':'ja';await page.selectOption('#customer-language',next);
    await page.waitForFunction(value=>document.querySelector('#product-experience-action').textContent===value,require('../js/demeos-item-presentation-copy')[next].buyDemeos);
    await page.locator('#product-experience-back').click();
   }
   await page.selectOption('#customer-language','ja');
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor();
   await page.waitForFunction(b=>document.querySelector('#customer-work-status').textContent===b,copy.ja.banner);
   assert.equal(await cards.count(),6,'direct entry and reload remain controlled');
   await page.goto(base+'/customer.html#discover',{waitUntil:'networkidle'});
   await page.locator('#customer-work-list[data-controlled-test="false"]').waitFor({state:'attached'});
   assert.equal(await page.locator('[data-work-item-id^="test-discover-"]').count(),0,'normal mode never shows controlled records');
   assert.equal(await page.locator('#customer-controlled-test-entry').isVisible(),false,'ordinary public browsing never exposes a testing control');
   await page.goto(base+'/customer.html?demeos-test=1#discover',{waitUntil:'networkidle'});
   await page.locator('#customer-work-list[data-controlled-test="true"]').waitFor();
   assert.equal(await cards.count(),6,'explicit controlled route consistently activates feed');

   await page.selectOption('#customer-language','en');
   await page.locator('#customer-work-list img').evaluateAll(async images=>{images.forEach(im=>{im.loading='eager';});await Promise.all(images.map(im=>im.decode()));});
   await page.screenshot({path:'/tmp/demeos-controlled-'+viewport.width+'.png',fullPage:true});
   if(local) {
    await page.route('**/api/customer/work?demeos-test=1',route=>route.fulfill({json:{work:[],testMode:false}}));
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.customer-discover-retry').waitFor();
    assert.equal(await page.locator('#customer-controlled-test-exit').getAttribute('href'),'customer.html#discover','normal entry remains separate');
    assert.ok(!(await page.locator('#customer-controlled-test-entry').isVisible()));
    assert.equal(await page.locator('.customer-work-card').count(),0,'disabled test mode fails closed');
   }
   assert.deepEqual(errors,[]);
   console.log('Controlled media and continuation verified at '+viewport.width+'px');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
