'use strict';
// Shipped UI -> real HTTP handler -> authoritative registry. Clerk is a named
// fixture here; this does NOT prove deployed sign-in, GPU or persistence.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createHandler}=require('../api/_lib/root-intelligence');
const copy=require('../js/root-ai-copy');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{SCHEMA,createStore}=require('../api/_lib/root-work-store');
const db=new PGlite(),database=createDatabase(db);
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'root-gate',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'root-gate',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',POSTGRES_URL:'postgresql://fixture:fixture@isolated.example/isolated',DEMEOS_ROOT_PERSISTENCE_ENABLED:'true',DEMEOS_ROOT_PREVIEW_OWNER_IDS:'["root-only-no-vendor"]'};
const baseDir=path.resolve(__dirname,'..');
// Named catalogue/auth fixtures, through the actual existing search handler.
// No model, live customer identity or published deployment evidence is implied.
const persistence=require('../api/_lib/persistence'),customerAuth=require('../api/_lib/demeos-customer-authentication');
const savedRepository=persistence.getRepository,savedIdentity=customerAuth.resolveTrustedCustomerIdentityFromRequest;
persistence.getRepository=()=>({getCustomerWork:async()=>[
 ...[['cheap','£89'],['expensive','£160']].map(([id,price])=>({workItemId:id,businessId:'business-'+id,businessName:'Published '+id,content:'Black waterproof jacket',participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:'Black jacket',description:'Black waterproof jacket',availability:'available',price,continuationRoute:'website'}]}))
]});
customerAuth.resolveTrustedCustomerIdentityFromRequest=async()=>null;
const customerSearchHandler=require('../api/customer/possibilities');
persistence.getRepository=savedRepository;customerAuth.resolveTrustedCustomerIdentityFromRequest=savedIdentity;
let customerSearchRequests=0;
const handler=createHandler({authenticate:async req=>req.headers.authorization==='Bearer root-browser-auth-fixture'?{trustedIdentityId:'root-only-no-vendor'}:null,environment:()=>env,workStore:()=>createStore(database),customerSearchHandler:async(req,res)=>{customerSearchRequests++;return customerSearchHandler(req,res);}});
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/public-config'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({clerkPublishableKey:'pk_test_'+Buffer.from('root-auth-fixture.example$').toString('base64')}));}
  if(url.pathname==='/api/root/workspace'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){res.writeHead(413);return res.end();}}
   req.query=Object.fromEntries(url.searchParams);req.body=raw?JSON.parse(raw):undefined;
   res.status=code=>{res.statusCode=code;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};return await handler(req,res);
  }
  const filename=path.resolve(baseDir,'.'+(url.pathname==='/root-ai'?'/root-ai.html':url.pathname));
  if(!filename.startsWith(baseDir+path.sep)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.png')?'image/png':filename.endsWith('.json')?'application/json':'text/html');fs.createReadStream(filename).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
 }catch{res.statusCode=500;res.end();}
});
(async()=>{
 for(const statement of SCHEMA)await database.query(statement);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await(process.env.DEMEOS_BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});
 try{
  for(const width of [375,820,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   await context.addInitScript(()=>{window.__internal_ClerkUICtor={};const listeners=[];window.Clerk={user:{id:'root-only-no-vendor'},session:{id:'fixture-session',getToken:async()=>'root-browser-auth-fixture'},load:async()=>{},addListener:fn=>listeners.push(fn),signOut:async()=>{window.Clerk.user=null;window.Clerk.session=null;listeners.forEach(fn=>fn());}};});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:'+server.address().port+'/root-ai');await page.locator('#workspace:not([hidden])').waitFor();
   assert.equal(await page.locator('#category option').count(),172);assert.equal(await page.locator('#capabilities li').count(),171);
   assert.equal(await page.locator('.identity img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
   assert.equal(await page.locator('#category').isVisible(),false);assert.equal(await page.locator('#capabilities').isVisible(),false);await page.locator('#category-diagnostics summary').click();await page.locator('#text').fill('Groceries');await page.locator('#category').selectOption('9');await page.locator('#run').click();await page.locator('#result:not([hidden])').waitFor();assert.match(await page.locator('#evidence').innerText(),/Groceries/);
   await page.locator('#save-consent').check();await page.locator('#save-work').click();await page.locator('#save-status').filter({hasText:copy.translate('en','workSaved')}).waitFor();await page.locator('#work-history button').first().click();await page.locator('#accept-work').click();await page.locator('#review-status').filter({hasText:copy.translate('en','reviewSaved')}).waitFor();await page.locator('#review-text').fill('Owner correction '+width);await page.locator('#correct-work').click();await page.locator('#review-status').filter({hasText:copy.translate('en','reviewSaved')}).waitFor();await page.reload();await page.locator('#workspace:not([hidden])').waitFor();await page.locator('#work-history button').first().click();assert.equal(await page.locator('#review-text').inputValue(),'Owner correction '+width);await page.locator('#reject-work').click();await page.locator('#review-status').filter({hasText:copy.translate('en','reviewSaved')}).waitFor();
   await page.locator('#text').fill('<script>throw new Error("unsafe")</script>');assert.equal(await page.locator('#result').isVisible(),false);await page.locator('#run').click();await page.locator('#result:not([hidden])').waitFor();assert.match(await page.locator('#evidence blockquote').innerText(),/<script>/);
   await page.locator('#customer').click();await page.locator('#workspace:not([hidden])').waitFor();assert.equal(await page.locator('#text').inputValue(),'');assert.equal(await page.locator('#result').isVisible(),false);assert.equal(await page.locator('#customer').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#work-history button').count(),0,'Customer history is isolated from Business');
   assert.equal(await page.locator('#integration').isVisible(),false);assert.equal(await page.locator('#customer-search').isVisible(),true);
   const beforeSearch=customerSearchRequests;
   await page.locator('#text').fill('black waterproof jacket under £100');await page.locator('#search-customer').click();assert.equal(customerSearchRequests,beforeSearch,'No search without explicit confirmation');
   await page.locator('#search-consent').check();await page.locator('#search-customer').click();await page.locator('#search-status').filter({hasText:copy.translate('en','searchFound')}).waitFor();
   assert.equal(await page.locator('#search-results li').count(),1);assert.match(await page.locator('#search-results').innerText(),/Published cheap/);assert.doesNotMatch(await page.locator('#search-results').innerText(),/expensive/);assert.equal(await page.locator('#search-consent').isChecked(),false);
   await page.locator('#text').fill('unrelated telescope orchestra');assert.equal(await page.locator('#search-results li').count(),0);assert.equal(await page.locator('#search-consent').isChecked(),false);
   await page.locator('#search-consent').check();await page.locator('#search-customer').click();await page.locator('#search-status').filter({hasText:copy.translate('en','searchEmpty')}).waitFor();assert.equal(await page.locator('#search-results li').count(),0);
   for(const locale of Object.keys(copy.rows)){
    await page.locator('#language').selectOption(locale);await page.locator('#workspace:not([hidden])').waitFor();assert.equal(await page.locator('h1').innerText(),copy.translate(locale,'heading'));assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+width+' '+locale);
   }
   await page.locator('#language').selectOption('en');await page.locator('#workspace:not([hidden])').waitFor();await page.locator('#development-tools summary').click();await page.locator('#filter').fill('Groceries');assert.equal(await page.locator('#capabilities li').count(),1);
   await page.screenshot({path:path.join(process.env.DEMEOS_BROWSER_ARTIFACT_DIR||'/tmp','demeos-root-'+width+'.png'),fullPage:true});
   await page.locator('#signout').click();await page.locator('#signin:not([hidden])').waitFor();assert.equal(await page.locator('#workspace').isVisible(),false);assert.deepEqual(errors,[]);await context.close();console.log('ROOT HTTP/browser fixture gate passed at',width,'px, ten locales; no genuine Clerk/GPU/persistence claim');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
