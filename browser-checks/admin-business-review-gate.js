'use strict';
// Isolated provider adapter and disposable PostgreSQL; never production approvals.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>{const id=req.headers.cookie?.match(/engineering-identity=([a-z0-9-]+)/)?.[1];return id?{trustedIdentityId:id,...(id==='admin-test'?{actorScope:'demeos-admin'}:{})}:null;};
const handler=require('../api/businesses'),owner=require('../api/businesses/[businessId]'),publicWork=require('../api/customer/work');
const profile={businessId:'application-000',profileVersion:4,name:'Isolated application',type:'Clothing',location:'London',productsServices:'Saved clothing information',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Show accurate offers',preparationModel:'both',offeringCategoryId:'fashion.apparel',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'contact'},products:[],informationStatus:{source:'business-owner',status:'business-provided',ownerConfirmedAt:'2026-10-10T02:00:00.000Z',reviewState:'submitted',submittedAt:'2026-10-10T02:01:00.000Z'}};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);return res.end();}}req.body=raw?JSON.parse(raw):{};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 if(url.pathname==='/api/businesses')return handler(req,res);
 let match=url.pathname.match(/^\/api\/admin\/business-applications(?:\/([^/]+))?$/);if(match){req.query.resource='admin-applications';if(match[1])req.query.businessId=decodeURIComponent(match[1]);return handler(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)$/);if(match){req.query.businessId=decodeURIComponent(match[1]);return owner(req,res);}
 if(url.pathname==='/api/customer/work')return publicWork(req,res);
 if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Unavailable'});
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});
async function adapter(context,id){await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Clerk={user:'+JSON.stringify(id?{id}:null)+',session:null,async load(){},addListener(fn){this.listener=fn},openSignIn(){window.signInCalls=(window.signInCalls||0)+1},async signOut(){this.user=null;this.listener({user:null})}};'}));}
(async()=>{let browser;try{
 await database.ensureSchema();for(let i=0;i<27;i++)await repository.createBusinessForOwner('owner-test',{...profile,businessId:'application-'+String(i).padStart(3,'0'),name:'Isolated application '+i});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.DEMEOS_BROWSER_CHANNEL?{channel:process.env.DEMEOS_BROWSER_CHANNEL}:{})});
 for(const width of [390,820,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await context.addCookies([{name:'engineering-identity',value:'admin-test',url:base}]);await adapter(context,'admin-test');
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/admin.html');await page.locator('.application-card').first().waitFor();assert.equal(await page.locator('.application-card').count(),25);
  await page.locator('#admin-next').click();await page.waitForFunction(()=>document.querySelectorAll('.application-card').length===2);assert.equal(await page.locator('#admin-next').isHidden(),true);
  await page.locator('#admin-reload').click();await page.waitForFunction(()=>document.querySelectorAll('.application-card').length===25);
  const id='application-'+String([390,820,1440].indexOf(width)).padStart(3,'0');
  await page.locator('.application-card').filter({hasText:'Isolated application '+[390,820,1440].indexOf(width)}).first().getByRole('button').click();await page.locator('#admin-detail:not([hidden])').waitFor();
  assert.match(await page.locator('#admin-facts').innerText(),/owner-test/);assert.match(await page.locator('#admin-facts').innerText(),/https:\/\/example.org\/shop/);assert.equal(await page.locator('#admin-record').isEnabled(),true);
  for(const code of ['en','es','fr','pt','de','ar','zh','hi','ja']){await page.locator('#admin-language').selectOption(code);assert.equal(await page.locator('html').getAttribute('lang'),code);assert.equal(await page.locator('html').getAttribute('dir'),code==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.match(await page.locator('#admin-facts').innerText(),/Saved clothing information/);}
  await page.locator('#admin-language').selectOption('en');await page.screenshot({fullPage:true,path:'/tmp/demeos-admin-review-'+width+'.png'});
  await page.locator('#admin-decision').selectOption('changes-requested');await page.locator('#admin-notes').fill('Private audit note');await page.locator('#admin-confirm').check();const posted=page.waitForResponse(r=>r.request().method()==='POST');await page.locator('#admin-record').click();assert.equal((await posted).status(),200);await page.locator('#admin-audit').filter({hasText:'Private audit note'}).waitFor();assert.equal(await page.locator('#admin-record').isDisabled(),true);
  const audit=(await repository.getBusinessApplication(id)).reviews;assert.equal(audit.length,1);assert.equal(audit[0].administrator_id,'admin-test');
  const ownerContext=await browser.newContext();await ownerContext.addCookies([{name:'engineering-identity',value:'owner-test',url:base}]);
  let record=await (await ownerContext.request.get(base+'/api/businesses/'+id)).json();assert.equal(record.workspaceReadiness.onboarding.status,'changes-requested');assert.equal(record.workspaceReadiness.onboarding.approved,false);assert.equal(record.workspaceReadiness.selling.canSell,false);assert.equal(record.applicationReview.notes,undefined);
  assert.equal((await ownerContext.request.get(base+'/api/admin/business-applications')).status(),403);
  assert.equal((await ownerContext.request.put(base+'/api/businesses/'+id,{data:{businessProfile:{...record.businessProfile,name:'Revised saved application'},ownerAccuracyConfirmed:true}})).status(),204);
  record=await (await ownerContext.request.get(base+'/api/businesses/'+id)).json();assert.equal(record.workspaceReadiness.onboarding.status,'draft');assert.equal((await repository.getBusinessApplication(id)).reviews.length,1);
  assert.equal((await ownerContext.request.put(base+'/api/businesses/'+id,{data:{action:'submit-business',reviewedProfile:record.businessProfile,ownerAccuracyConfirmed:true}})).status(),200);assert.deepEqual((await (await ownerContext.request.get(base+'/api/customer/work')).json()).work,[]);
  await page.locator('#admin-reload').click();await page.locator('.application-card').filter({hasText:'Revised saved application'}).first().getByRole('button').click();await page.locator('#admin-record:enabled').waitFor();
  await context.clearCookies();const revoked=page.waitForResponse(r=>r.url().includes('/api/admin/business-applications'));await page.locator('#admin-reload').click();assert.equal((await revoked).status(),401);await page.locator('#admin-private').waitFor({state:'hidden'});assert.doesNotMatch(await page.locator('body').innerText(),/Private audit note|owner-test|Revised saved application/);
  await context.addCookies([{name:'engineering-identity',value:'admin-test',url:base}]);await page.reload();await page.locator('#admin-private:not([hidden])').waitFor();await page.locator('#admin-sign-out').click();assert.equal(await page.locator('#admin-private').isHidden(),true);assert.deepEqual(errors,[]);
  await context.close();await ownerContext.close();console.log('Private admin SQL review, revision, owner status, pagination, nine languages and access removal passed',width);
 }
 for(const id of [null,'owner-test','customer-test']){const context=await browser.newContext();if(id)await context.addCookies([{name:'engineering-identity',value:id,url:base}]);await adapter(context,id);const page=await context.newPage();await page.goto(base+'/admin.html');await page.locator('#admin-status').filter({hasText:id?'Administrator permission required.':'Sign in'}).waitFor();assert.equal(await page.locator('#admin-private').isHidden(),true);if(!id){await page.locator('#admin-sign-in').click();assert.equal(await page.evaluate(()=>signInCalls),1);}await context.close();}
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await client.close();}})().catch(error=>{console.error(error);process.exitCode=1});
