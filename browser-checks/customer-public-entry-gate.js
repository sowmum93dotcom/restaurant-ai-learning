/* Public homepage and information destinations use the shared nine-language preference. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const registry=require('../js/demeos-language-registry');
const copy=require('../js/demeos-public-copy');
const base=process.env.DEMEOS_BROWSER_BASE_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  let authenticatedRequests=0;
  await context.route('**/api/customer/**',route=>{const request=route.request();if(!request.url().includes('/work'))authenticatedRequests++;assert.equal(request.headers()['x-demeos-test-mode'],undefined);return route.fulfill({json:{work:[],testMode:false,customerPackages:[]}});});
  await context.route('**/api/public-config',route=>route.fulfill({status:503,json:{reason:'unavailable'}}));
  for(const language of registry.languages){
   await page.goto(base+'/index.html?demeos-test=0');await page.locator('#customer-language').selectOption(language.code);
   assert.equal(await page.locator('#welcome-title').textContent(),copy[language.code].headline);
   assert.equal(await page.locator('html').getAttribute('dir'),language.direction);
   for(const selector of ['#customer-entry-link','#business-entry-link']){
    const button=page.locator(selector),rect=await button.boundingBox();assert.ok(rect.height>=44&&rect.x>=0&&rect.x+rect.width<=viewport.width,'entry touch target stays within screen');
   }
   assert.equal(await page.locator('#business-entry-link').getAttribute('href'),'business-workspace.html');
   assert.ok(!/controlled|development|test/i.test(await page.locator('body').innerText()),'ordinary homepage has no development controls');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'homepage translation has no horizontal overflow');
   if(['en','ar','de'].includes(language.code))await page.screenshot({path:'/tmp/demeos-home-'+viewport.width+'-'+language.code+'.png',fullPage:true});
   await page.locator('#customer-entry-link').click();await page.locator('#customer-work-list[data-controlled-test="false"]').waitFor({state:'attached'});
   assert.equal(new URL(page.url()).searchParams.get('demeos-test'),'0');
   assert.equal(await page.locator('#customer-language').inputValue(),language.code,'Discover preserves language');
   assert.equal(await page.locator('#customer-controlled-test-entry').isVisible(),false);
   assert.equal(authenticatedRequests,0,'browsing requires no account API');
   if(['en','ar','de'].includes(language.code))await page.screenshot({path:'/tmp/demeos-public-discover-'+viewport.width+'-'+language.code+'.png',fullPage:true});
   await page.locator('.customer-journey-nav a[href="#intention"]').click();await page.locator('#intention:not([hidden])').waitFor();
   assert.equal(new URL(page.url()).hash,'#intention','ordinary navigation reaches the intention screen');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'public intention has no language overflow');
   if(['en','ar','de'].includes(language.code))await page.screenshot({path:'/tmp/demeos-public-intention-'+viewport.width+'-'+language.code+'.png',fullPage:true});
   await page.locator('.customer-journey-nav a[href="#discover"]').click();await page.locator('#discover:not([hidden])').waitFor();
   assert.equal(authenticatedRequests,0,'public intention and navigation require no account API');
   for(const destination of ['privacy','terms','contact']){
    await page.goto(base+'/'+destination+'.html');assert.equal(await page.locator('h1').textContent(),copy[language.code][destination]);
    assert.equal(await page.locator('#customer-language').inputValue(),language.code);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'information translation has no overflow');
    for(const href of await page.locator('main a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))))assert.ok(href&&!href.startsWith('#'),'information actions have real destinations');
   }
  }
  assert.deepEqual(errors,[]);console.log('Public entry gate passed',viewport.width,'nine languages, public browsing, real information destinations');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
