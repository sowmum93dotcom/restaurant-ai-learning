/* The same pages keep their chosen data context; never fall back to test data. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {productExperienceTestContent}=require('../api/_lib/controlled-customer-test-content');
const {getValidPublicCustomerWork}=require('../api/_lib/customer-public-work-contract');
const base=process.env.DEMEOS_BROWSER_BASE_URL||'http://127.0.0.1:4173';
const controlledWork=getValidPublicCustomerWork(productExperienceTestContent());
const publicWork=getValidPublicCustomerWork([{workItemId:'approved-public-work',businessId:'public-business',businessName:'Public business',content:'Business-provided product information',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://business.example/product'},products:[{productId:'public-product',businessId:'public-business',name:'Public product',description:'Business-provided product',price:'25',availability:'available',continuationRoute:'website'}]}]);
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  let approved=false,disabled=false,failed=false;
  await context.route('**/api/customer/work*',route=>{
   const req=route.request(),url=new URL(req.url());
   assert.equal(url.searchParams.get('source'),'discover');assert.equal(url.searchParams.get('demeos-test'),'1');
   assert.equal(req.headers()['x-demeos-test-mode'],'controlled-preview');
   if(failed)return route.fulfill({status:500,json:{error:'unavailable'}});
   return route.fulfill({json:{work:approved?publicWork:disabled?[]:controlledWork,testMode:!approved&&!disabled,customerPackages:[]}});
  });
  await context.route('**/api/public-config',route=>route.fulfill({status:503,json:{reason:'unavailable'}}));
  await context.route('**/api/customer/preparation*',route=>route.fulfill({status:401,json:{reason:'signed-out'}}));
  await context.route('**/api/customer/identity',route=>route.fulfill({status:401,json:{reason:'signed-out'}}));
  async function loaded(mode,count){await page.locator('#customer-work-list[data-controlled-test="'+mode+'"]').waitFor({state:'attached'});assert.equal(await page.locator('.customer-work-card').count(),count);assert.equal(new URL(page.url()).searchParams.has('demeos-test'),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
  // Direct entry, the homepage, old bookmarks and account returns share one main feed.
  await page.goto(base+'/customer.html#discover');await loaded(true,6);
  await page.goto(base+'/index.html');await page.locator('#customer-entry-link').click();await loaded(true,6);
  await page.locator('[data-product-id="test-product-activewear"] .customer-product-continue-action').click();await page.locator('#product-experience:not([hidden])').waitFor();
  await page.locator('select[data-option-key="size"]').selectOption('large');await page.locator('select[data-option-key="colour"]').selectOption('blue');
  await page.locator('#product-experience-action').click();await page.locator('#purchase-auth-selection').waitFor();
  await page.locator('.customer-journey-nav a').first().click();await loaded(true,6);
  await page.goto(base+'/my-demeos.html');await page.locator('.customer-journey-nav a').first().click();await loaded(true,6);
  await page.locator('.demeos-public-footer-links a').first().click();await page.locator('.demeos-entry-brand').click();await page.locator('#customer-entry-link').click();await loaded(true,6);
  for(const flag of ['0','1','true']){await page.goto(base+'/customer.html?demeos-test='+flag+'#discover');await loaded(true,6);}
  await page.reload();await loaded(true,6);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('demeos-customer-content-context-v1')),null);
  // Published business content replaces the temporary records on this exact same URL.
  approved=true;await page.goto(base+'/customer.html?resume=1#product-experience');await loaded(false,1);
  assert.equal(new URL(page.url()).hash,'#discover','obsolete dummy purchase returns to the main actual feed');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('demeos-controlled-preparation-v1')),null);
  assert.equal(await page.locator('[data-work-item-id^="test-discover-"]').count(),0);
  await page.locator('[data-product-id="public-product"] .customer-product-continue-action').click();await page.locator('#product-experience:not([hidden])').waitFor();
  assert.equal(await page.locator('#product-experience-action').getAttribute('href'),'https://business.example/product');
  await page.locator('.customer-journey-nav a').last().click();await page.locator('.customer-journey-nav a').first().click();await loaded(false,1);
  await page.screenshot({path:'/tmp/demeos-context-'+viewport.width+'.png'});
  // Independent sessions receive the same published feed, without remembered preview state.
  const fresh=await browser.newContext({viewport}),freshPage=await fresh.newPage();
  await fresh.route('**/api/customer/work*',route=>route.fulfill({json:{work:publicWork,testMode:false,customerPackages:[]}}));
  await freshPage.goto(base+'/customer.html#discover');await freshPage.locator('.customer-work-card').waitFor();assert.equal(await freshPage.locator('.customer-work-card').count(),1);await fresh.close();
  approved=false;disabled=true;await page.reload();await loaded(false,0);
  assert.equal(await page.locator('#customer-controlled-test-exit').isVisible(),false);
  assert.equal(await page.locator('#customer-controlled-test-entry').isVisible(),false);
  failed=true;await page.reload();await page.locator('.customer-discover-retry').waitFor();assert.equal(await page.locator('.customer-work-card').count(),0);
  failed=false;disabled=false;await page.locator('.customer-discover-retry').click();await loaded(true,6);
  assert.deepEqual(errors,[]);console.log('Main Discover feed gate passed',viewport.width,'one address, automatic approved-content replacement, account returns, disable and retry');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
