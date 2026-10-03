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
  let controlledRequests=0,publicRequests=0,empty=false;
  await context.route('**/api/customer/work*',route=>{
   const req=route.request(),url=new URL(req.url()),flag=url.searchParams.get('demeos-test'),header=req.headers()['x-demeos-test-mode'];
   assert.equal(flag==='1',header==='controlled-preview','query/header activation pair remains intact');
   if(flag==='1')controlledRequests++;else publicRequests++;
   return route.fulfill({json:{work:flag==='1'?controlledWork:empty?[]:publicWork,testMode:flag==='1',customerPackages:[]}});
  });
  await context.route('**/api/public-config',route=>route.fulfill({status:503,json:{reason:'unavailable'}}));
  await context.route('**/api/customer/identity',route=>route.fulfill({status:401,json:{reason:'signed-out'}}));
  async function loaded(controlled){await page.locator('#customer-work-list[data-controlled-test="'+controlled+'"]').waitFor({state:'attached'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
  // Start with ordinary approved content, on the same permanent pages.
  await page.goto(base+'/index.html?demeos-test=0');await page.locator('#customer-entry-link').click();await loaded(false);
  assert.equal(await page.locator('.customer-work-card').count(),1);assert.equal(controlledRequests,0);
  await page.locator('[data-product-id="public-product"] .customer-product-continue-action').click();await page.locator('#product-experience:not([hidden])').waitFor();
  assert.equal(await page.locator('#product-experience-action').getAttribute('href'),'https://business.example/product');
  await page.locator('#product-experience-back').click();await page.locator('.customer-journey-nav a').last().click();
  await page.locator('.customer-journey-nav a').first().click();await loaded(false);assert.equal(controlledRequests,0,'public account return cannot enable test content');
  // A fresh homepage chooses the explicit development default, without a special URL.
  await context.clearCookies();await page.evaluate(()=>sessionStorage.clear());
  await page.goto(base+'/index.html');await page.locator('#customer-entry-link').click();await loaded(true);
  assert.equal(await page.locator('.customer-work-card').count(),6);
  await page.locator('[data-product-id="test-product-activewear"] .customer-product-continue-action').click();await page.locator('#product-experience:not([hidden])').waitFor();
  await page.locator('select[data-option-key="size"]').selectOption('large');await page.locator('select[data-option-key="colour"]').selectOption('blue');
  const before=publicRequests;
  await page.locator('.customer-journey-nav a').last().click();await page.locator('.customer-journey-nav a').first().click();await loaded(true);
  // Legacy/clean bookmarks and homepage sign-in also recover the current tab context.
  await page.goto(base+'/my-demeos.html');await page.locator('.customer-journey-nav a').first().click();await loaded(true);
  await page.goto(base+'/index.html');await page.locator('.demeos-entry-signin').click();await page.locator('.customer-journey-nav a').first().click();await loaded(true);
  await page.locator('.demeos-public-footer-links a').first().click();await page.locator('.demeos-entry-brand').click();await page.locator('#customer-entry-link').click();await loaded(true);
  await page.goto(base+'/customer.html#discover');await loaded(true);await page.reload();await loaded(true);
  assert.equal(publicRequests,before,'no navigation accidentally switches data sources');
  await page.screenshot({path:'/tmp/demeos-context-'+viewport.width+'.png'});
  // Explicit exit clears the tab choice; a genuinely empty public feed stays empty.
  empty=true;await page.locator('#customer-controlled-test-exit').click();await loaded(false);
  assert.equal(await page.locator('.customer-work-card').count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('demeos-customer-content-context-v1')),'production');
  const afterExit=controlledRequests;
  await page.goto(base+'/index.html');await page.locator('#customer-entry-link').click();await loaded(false);assert.equal(controlledRequests,afterExit,'empty public data never falls back to controlled content');
  // A fresh explicit production context never receives temporary records.
  const fresh=await browser.newContext({viewport}),freshPage=await fresh.newPage();
  await fresh.route('**/api/customer/work*',route=>{assert.equal(route.request().headers()['x-demeos-test-mode'],undefined);assert.equal(new URL(route.request().url()).searchParams.has('demeos-test'),false);return route.fulfill({json:{work:[],testMode:false,customerPackages:[]}});});
  await freshPage.goto(base+'/customer.html?demeos-test=0#discover');await freshPage.locator('#customer-work-list[data-controlled-test="false"]').waitFor({state:'attached'});assert.equal(await freshPage.locator('.customer-work-card').count(),0);await fresh.close();
  assert.deepEqual(errors,[]);console.log('Customer context gate passed',viewport.width,'same pages, homepage/account/refresh continuity, approved public content and explicit exit isolation');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
