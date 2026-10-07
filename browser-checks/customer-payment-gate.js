/* Controlled status adapter only: no provider, money movement or real account creation. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {createHandler}=require('../api/_lib/customer-checkout');
const copy=require('../js/demeos-purchase-preparation-copy');
const base=process.env.DEMEOS_BROWSER_BASE_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [390,820,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let authenticated=true,state='pending',serviceReceipt=false,hold=false,release,temporary=true;
  await context.route('**/api/customer/work*',route=>route.fulfill({json:{work:temporary?[{workItemId:'test-discover-fashion'}]:[],testMode:temporary}}));
  await context.route('**/api/public-config',r=>r.fulfill({json:{clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')}}));
  await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
  await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Clerk={user:{},async load(){},__internal_updateProps(){},addListener(fn){this.listener=fn;},signOut(){this.user=null;this.listener();}};'}));
  await context.route('**/api/customer/identity',r=>r.fulfill({json:{authenticated}}));
  for(const path of ['intentions','preferences','participation','possibilities/saved','privacy-controls'])await context.route('**/api/customer/'+path,r=>r.fulfill({json:{intentions:[],preferences:[],participations:[],possibilities:[],controls:{usePreferencesAsGuidance:false,useFeedbackAsGuidance:false}}}));
  await context.route('**/api/customer/checkout*',async route=>{
   const url=new URL(route.request().url());const isAuthenticated=authenticated;
   const service={capabilities:()=>({configured:true,mode:'test',recipient:'business',livePayments:false}),async receipts(customer){assert.equal(customer,'browser-only-customer');return [{reference:'own-reference',testMode:true,recipient:'business',state:'paid',productId:'test-product-activewear',productName:'Controlled outfit'}];},async receipt(customer,reference){assert.equal(customer,'browser-only-customer');if(reference!=='own-reference')return null;if(hold)await new Promise(resolve=>release=resolve);return {reference,testMode:true,recipient:'business',state,businessId:'test-business-fashion',productId:serviceReceipt?'test-product-running':'test-product-activewear',selection:serviceReceipt?{duration:'minutes30',people:'onePerson'}:{size:'extraLarge',colour:'blue'},quantity:serviceReceipt?1:2,currency:'GBP',totalMinor:9400,refundedMinor:state==='refunded'?9400:state==='partially-refunded'?4700:0};}};
   const res={setHeader(){},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};
   await createHandler({service,authenticate:async()=>isAuthenticated?{trustedCustomerIdentityId:'browser-only-customer'}:null,repository:()=>({getOwnedBusinessIds:async()=>[]})})({method:'GET',headers:route.request().headers(),query:Object.fromEntries(url.searchParams)},res);await route.fulfill({status:res.statusCode,json:res.body});
  });
  await page.goto(base+'/my-demeos.html?demeos-test=1&payment=own-reference',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#customer-payment-summary').textContent.includes('own-reference'));
  const statusKeys={pending:'paymentPending',paid:'paymentPaid',failed:'paymentFailed',cancelled:'paymentCancelled','partially-refunded':'paymentPartialRefund',refunded:'paymentRefunded'};
  for(const language of Object.keys(copy)){
   await page.selectOption('#customer-language',language);
   for(const [next,key] of Object.entries(statusKeys)){state=next;await page.locator('#customer-payment-refresh').click();await page.waitForFunction(text=>document.querySelector('#customer-payment-summary').textContent.includes(text),copy[language][key]);assert.equal(await page.locator('#customer-payment-title').textContent(),copy[language].paymentTitle);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert.ok((await page.locator('#customer-payment-summary').textContent()).includes('XL'));if(language!=='en')assert.ok(!(await page.locator('#customer-payment-summary').textContent()).includes('DEMEOS Test Fashion'));
  }
  serviceReceipt=true;state='paid';await page.locator('#customer-payment-refresh').click();await page.waitForFunction(text=>document.querySelector('#customer-payment-summary').textContent.includes(text),require('../js/demeos-controlled-customer-copy').ja.products[3]);assert.ok((await page.locator('#customer-payment-summary dt').allTextContents()).includes(require('../js/demeos-item-presentation-copy').ja.service),'service receipt is labelled as a service');serviceReceipt=false;
  await page.screenshot({path:'/tmp/demeos-payment-status-'+width+'.png',fullPage:true});
  hold=true;await page.locator('#customer-payment-refresh').click();while(!release)await page.waitForTimeout(10);authenticated=false;await page.locator('#customer-sign-out').click();release();await page.waitForTimeout(100);assert.equal(await page.locator('#customer-payment-summary').textContent(),'');assert.equal(await page.locator('#customer-payment-message').textContent(),copy.ja.paymentSignIn,'late status response cannot reveal a receipt after sign-out');
  authenticated=true;hold=false;await page.goto(base+'/my-demeos.html?demeos-test=1',{waitUntil:'networkidle'});await page.locator('.customer-payment-history-link').waitFor();for(const language of Object.keys(copy)){await page.selectOption('#customer-language',language);assert.equal(await page.locator('#customer-payment-title').textContent(),copy[language].paymentHistory);assert.equal(await page.locator('.customer-payment-history-link span').textContent(),copy[language].paymentPaid);}await page.locator('.customer-payment-history-link').click();await page.waitForURL('**/my-demeos.html?payment=own-reference');await page.waitForFunction(()=>document.querySelector('#customer-payment-summary').textContent.includes('own-reference'));
  authenticated=true;hold=false;await page.goto(base+'/my-demeos.html?demeos-test=1&payment=other-reference',{waitUntil:'networkidle'});await page.waitForFunction(text=>document.querySelector('#customer-payment-message').textContent===text,copy.ja.paymentMissing);assert.equal(await page.locator('#customer-payment-summary').textContent(),'');
  temporary=false;await page.goto(base+'/my-demeos.html',{waitUntil:'networkidle'});assert.equal(await page.locator('#customer-payment-panel').isVisible(),false,'ordinary production has no controlled payment panel');assert.deepEqual(errors,[]);console.log('Payment status gate passed',width,'nine languages, own receipts, all states, refund totals, sign-out isolation');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
