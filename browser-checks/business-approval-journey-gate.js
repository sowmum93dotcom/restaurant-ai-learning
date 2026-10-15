'use strict';
// Actual owner APIs/repository/SQL with an isolated identity-provider adapter.
// No production account, business, publication or external provider is used.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>{const id=req.headers.cookie?.match(/engineering-owner=([a-z0-9-]+)/)?.[1];return id?{trustedIdentityId:id,...(id==='admin-test'?{actorScope:'demeos-admin'}:{})}:null;};
const list=require('../api/businesses'),business=require('../api/businesses/[businessId]'),campaign=require('../api/businesses/[businessId]/campaigns/[campaignId]'),media=require('../api/businesses/[businessId]/media/index'),publicWork=require('../api/customer/work');
const inventory=require('../api/businesses/[businessId]/inventory'),products=require('../api/businesses/[businessId]/products'),ordersHandler=require('../api/businesses/[businessId]/orders');
const checkout=require('../api/_lib/customer-checkout').createHandler({authenticate:async req=>{const identity=await auth.resolveTrustedIdentityFromRequest(req);return identity?{trustedCustomerIdentityId:identity.trustedIdentityId}:null;},repository:()=>repository});
const generatorModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/generate.js'),'utf8').replace('export default async function handler','module.exports = async function handler'),{module:generatorModule,require:createRequire(path.join(root,'api/generate.js')),console,process:{env:{}},fetch(){throw Error('No external provider may be called');}});
const asset={businessId:'engineering-a',assetId:'engineering-image',relatedEntityId:'offer-a',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
const profile={applicationAccess:{marketing:true,selling:true},businessId:'engineering-a',name:'Engineering Owner A',type:'Fashion',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share saved products',profileVersion:4,preparationModel:'both',offeringCategoryId:'fashion.apparel',productsServices:'Owner products',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'engineering-a',productId:'offer-a',name:'Exact jacket',description:'Saved jacket description',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:true,fulfilment:{methods:['collection']},presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'exact-medium',selection:{size:'M'},availability:'limited',pricing:{mode:'fixed',currency:'GBP',amount:91},future:'retained'}],future:'retained'}}]};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
 // GET/HEAD document requests have no body. Do not wait for a request stream
 // before sending the HTML: navigation must complete even on a reused socket.
 req.body={};
 if(!['GET','HEAD'].includes(req.method)){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);res.end();return;}}
  req.body=raw?JSON.parse(raw):{};
 }
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 const admin=url.pathname.match(/^\/api\/admin\/business-applications(?:\/([^/]+))?$/);if(admin){req.query.resource='admin-applications';if(admin[1])req.query.businessId=admin[1];return await list(req,res);}
 if(url.pathname==='/api/businesses')return await list(req,res);
 const vendor=url.pathname.match(/^\/api\/businesses\/([^/]+)\/(inventory|products|orders)$/);if(vendor){req.query.businessId=vendor[1];return await ({inventory,products,orders:ordersHandler}[vendor[2]])(req,res);}
 let match=url.pathname.match(/^\/api\/businesses\/([^/]+)(?:\/campaigns\/([^/]+))?$/);
 if(match){req.query.businessId=decodeURIComponent(match[1]);if(match[2]){req.query.campaignId=decodeURIComponent(match[2]);return await campaign(req,res);}return await business(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)\/media$/);if(match){req.query.businessId=match[1];return await media(req,res);}
 if(url.pathname==='/api/customer/checkout')return await checkout(req,res);
 if(url.pathname==='/api/generate')return await generatorModule.exports(req,res);
 if(url.pathname==='/api/customer/work')return await publicWork(req,res);
 if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Not configured'});
 const file=path.resolve(root,'.'+decodeURIComponent(({'/marketing-business':'/business-workspace.html','/marketing-business/manage':'/marketing.html','/marketing-business/results':'/business-results.html'}[url.pathname] || (url.pathname==='/'?'/business-workspace.html':url.pathname))));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
 // Deterministic static fixture delivery: an unhandled read-stream failure
 // must not leave a navigation response pending indefinitely.
 const contents=await fs.promises.readFile(file);
 res.setHeader('Content-Length',contents.length);
 res.end(req.method==='HEAD'?undefined:contents);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});

async function contextFor(browser,base,id,width){const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:'reduce'});context.setDefaultTimeout(15000);await context.addCookies([{name:'engineering-owner',value:id,url:base}]);
 await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
 await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Clerk={user:{id:'+JSON.stringify(id)+'},session:null,async load(){},addListener(fn){this.listener=fn},openSignIn(){},async signOut(){this.user=null;this.listener({user:null})}};'}));return context;}
(async()=>{let browser;try{
 await database.ensureSchema();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.DEMEOS_BROWSER_CHANNEL?{channel:process.env.DEMEOS_BROWSER_CHANNEL}:{})});
 for(const width of [390,820,1440])for(const model of ['marketing','selling','both']){
  const context=await contextFor(browser,base,'owner-'+model+'-'+width,width),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{void d.accept().catch(error=>{if(!/Not attached to an active page|Target page, context or browser has been closed/.test(String(error)))errors.push(String(error));});});
  await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-access=setup]').waitFor();await page.getByRole('link',{name:'Start business setup',exact:true}).click();
  await page.locator('#owner-authenticated-workspace:not([hidden])').waitFor();await page.locator('#business-offering-category option').last().waitFor({state:'attached'});
  const name='Isolated '+model+' '+width;
  await page.locator('#business-name').fill(name);await page.locator('#business-type').fill('Clothing');await page.locator('#business-location').fill('London');await page.locator('#business-products-services').fill('Owner supplied clothing');await page.locator('#business-offering-category').selectOption('fashion.apparel');
  await page.locator('#onboarding-preparation summary').click();await page.locator('#business-preparation-model').selectOption(model);await page.locator('#business-route-website').check();await page.locator('#business-website').fill('https://example.org/shop');await page.locator('#business-fulfilment-shipping').check();
  assert.equal(await page.locator('#onboarding-marketing').isVisible(),model!=='selling');
  if(model!=='selling'){await page.locator('#onboarding-marketing summary').click();await page.locator('#business-brand-voice').fill('Clear');await page.locator('#business-target-customer').fill('Local customers');await page.locator('#business-goal').fill('Share genuine offers');}
  await page.locator('#onboarding-review summary').click();await page.locator('#business-accuracy-confirmation').check();
  const created=page.waitForResponse(r=>r.request().method()==='PUT'&&/api\/businesses\//.test(r.url()));await page.locator('#save-business-profile-btn').click();assert.equal((await created).status(),204);
  await page.locator('#submit-business-btn:enabled').waitFor();const id=await page.evaluate(()=>localStorage.getItem('demeosActiveBusinessId'));
  let saved=(await repository.getKnownBusiness(id)).businessProfile;assert.equal(saved.applicationAccess,undefined);assert.equal((await context.request.get(base+'/api/businesses/'+id+'?application=selling')).status(),403);
  await page.locator('#business-accuracy-confirmation').check();const submitted=page.waitForResponse(r=>r.request().postDataJSON()?.action==='submit-business');await page.locator('#submit-business-btn').click();assert.equal((await submitted).status(),200);await page.locator('#business-onboarding-status').filter({hasText:'Submitted privately'}).waitFor();
  for(const code of ['en','es','fr','ar','pt','zh','hi','de','ja']){await page.locator('#owner-preparation-language').selectOption(code);const label=await page.locator('.owner-preparation-guide label').boundingBox(),select=await page.locator('#owner-preparation-language').boundingBox();assert.ok(label.y+label.height<=select.y,'Language label must not overlap selector');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('#onboarding-marketing').isVisible(),model!=='selling');}
  await page.locator('#owner-preparation-language').selectOption('en');await page.screenshot({fullPage:true,path:'/tmp/demeos-approval-onboarding-'+model+'-'+width+'.png'});
  assert.equal((await context.request.get(base+'/api/admin/business-applications')).status(),403);
  const adminContext=await contextFor(browser,base,'admin-test',width),adminPage=await adminContext.newPage();await adminPage.goto(base+'/admin.html');await adminPage.locator('.application-card').filter({hasText:name}).getByRole('button').click();await adminPage.locator('#admin-detail:not([hidden])').waitFor();
  async function decide(decision,applications){await adminPage.locator('#admin-decision').selectOption(decision);for(const application of ['marketing','selling'])if(await adminPage.locator('#admin-scope-'+application).isEnabled())await adminPage.locator('#admin-scope-'+application).setChecked(applications.includes(application));await adminPage.locator('#admin-confirm').check();const posted=adminPage.waitForResponse(r=>r.request().method()==='POST');await adminPage.locator('#admin-record').click();assert.equal((await posted).status(),200);await adminPage.locator('#admin-status').filter({hasText:'Decision recorded'}).waitFor();}
  const applications=model==='both'?['marketing','selling']:[model];
  // Registration, administrative decisions and server permissions survive retirement.
  await decide('approved',applications);
  for(const application of applications)assert.equal((await context.request.get(base+'/api/businesses/'+id+'?application='+application)).status(),200);
  assert.equal((await repository.getKnownBusiness(id)).businessProfile.preparationModel,model);
  if(model!=='selling'){
   await page.goto(base+'/marketing-business');await page.locator('body[data-owner-access=ready]').waitFor();
   assert.equal(await page.locator('body').getAttribute('data-owner-model'),'marketing');
   await page.screenshot({fullPage:true,path:'/tmp/demeos-approval-dashboard-'+model+'-'+width+'.png'});
  }else{
   await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-access=denied]').waitFor();
   assert.equal(await page.locator('.owner-application-entries a').count(),0);
   assert.equal((await context.request.get(base+'/api/businesses/'+id+'?application=marketing')).status(),403);
  }
  if(model==='marketing')assert.equal((await context.request.get(base+'/api/businesses/'+id+'/inventory')).status(),403);
  const revoked=model==='marketing'?'marketing':'selling';
  await decide('revoked',[revoked]);
  assert.equal((await context.request.get(base+'/api/businesses/'+id+'?application='+revoked)).status(),403);
  assert.equal((await context.request.get(base+'/api/businesses/'+id+'/inventory')).status(),403);
  if(model==='marketing'){await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('body[data-owner-access=revoked]').waitFor();}
  if(model==='both'){saved=(await repository.getKnownBusiness(id)).businessProfile;assert.equal(saved.applicationAccess.marketing,true);await page.goto(base+'/marketing-business');await page.locator('body[data-owner-access=ready]').waitFor();}
  assert.deepEqual(await repository.getCustomerWork(),[]);assert.deepEqual(errors,[]);await context.close();await adminContext.close();console.log('Registration, model, submission, scoped admin decision, application entry and revocation passed',model,width);
 }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await client.close();}})().catch(error=>{console.error(error);process.exitCode=1});
