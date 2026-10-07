// Browser -> real possibilities handler -> controlled/approved repository -> UI.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {buildCustomerUnderstanding}=require('../js/customer-understanding');
const persistence=require('../api/_lib/persistence');
let records=[];
persistence.getRepository=()=>({getCustomerWork:async()=>records});
const possibilities=require('../api/customer/possibilities');
const work=require('../api/customer/work');
const base=process.env.DEMEOS_BROWSER_BASE_URL||'http://127.0.0.1:4173';
async function serve(handler,route){
  const request=route.request(),url=new URL(request.url());
  const req={method:request.method(),headers:request.headers(),query:Object.fromEntries(url.searchParams),body:request.postDataJSON()};
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;}};
  await handler(req,res);await route.fulfill({status:res.statusCode,headers:res.headers,json:res.body});
}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
  records=[];const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await context.route('**/api/customer/work*',route=>serve(work,route));
  await context.route('**/api/customer/possibilities?*',route=>serve(possibilities,route));
  await context.route('**/api/customer/understanding',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{understanding:buildCustomerUnderstanding(body.intention,body.customerText,body.clarificationText)}});});
  await context.route('**/api/customer/identity',route=>route.fulfill({json:{authenticated:false}}));
  await context.route('**/api/public-config',route=>route.fulfill({status:503,json:{reason:'unavailable'}}));
  async function search(text,place=''){
   await page.goto(base+'/index.html');
   await page.goto(base+'/customer.html#intention');
   await page.locator('#customer-intention-text').fill(text);await page.locator('#customer-place').fill(place);
   await page.locator('#customer-intention-form button[type="submit"]').click();
   await page.locator('#customer-understanding-confirm').click();
   await page.waitForFunction(()=>!document.getElementById('customer-no-possibilities').hidden || document.querySelector('#customer-possibilities-list .customer-possibility-surface'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await search('jacket');assert.equal(await page.locator('.customer-possibility-surface').count(),1);
  await page.locator('.customer-possibility-surface').click();await page.locator('#customer-focused-possibility [data-product-id="test-product-mens-fashion"]').waitFor();
  await search('quiet dinner');assert.equal(await page.locator('#customer-no-possibilities').isVisible(),true);
  records=[{workItemId:'quiet',businessName:'Quiet business',content:'Quiet family dinner',location:'London',participationAction:'Interested'},
    {workItemId:'loud',businessName:'Lively business',content:'Lively family dinner',location:'London',participationAction:'Interested'}];
  await search('peaceful dinner','London');assert.equal(await page.locator('.customer-possibility-surface').count(),1);
  assert.match(await page.locator('.customer-possibility-surface').innerText(),/Quiet business/);
  await search('peaceful dinner','Paris');assert.equal(await page.locator('#customer-no-place-match-note').isVisible(),true);
  assert.deepEqual(errors,[]);console.log('Customer search gate passed',viewport.width);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
