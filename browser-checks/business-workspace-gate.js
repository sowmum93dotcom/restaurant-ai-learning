'use strict';
// Actual owner APIs/repository/SQL with an isolated identity-provider adapter.
// No production account, business, publication or external provider is used.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const designBaseline='8c4ccbc93af01480f41e6444446b79a321a11ef9';
const baselineFiles=['business-workspace.html','css/business-workspace-completion.css','js/business-workspace.js'].map(file=>[file,require('node:child_process').execFileSync('git',['show',designBaseline+':'+file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'})]);
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>{const id=req.headers.cookie?.match(/engineering-owner=(owner-[a-z0-9-]+)/)?.[1];return id?{trustedIdentityId:id}:null;};
const list=require('../api/businesses'),business=require('../api/businesses/[businessId]'),campaign=require('../api/businesses/[businessId]/campaigns/[campaignId]'),media=require('../api/businesses/[businessId]/media/index'),publicWork=require('../api/customer/work');
const checkout=require('../api/_lib/customer-checkout').createHandler({authenticate:async req=>{const identity=await auth.resolveTrustedIdentityFromRequest(req);return identity?{trustedCustomerIdentityId:identity.trustedIdentityId}:null;},repository:()=>repository});
const generatorModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/generate.js'),'utf8').replace('export default async function handler','module.exports = async function handler'),{module:generatorModule,require:createRequire(path.join(root,'api/generate.js')),console,process:{env:{}},fetch(){throw Error('No external provider may be called');}});
const asset={businessId:'engineering-a',assetId:'engineering-image',relatedEntityId:'offer-a',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
const profile={businessId:'engineering-a',name:'Engineering Owner A',type:'Fashion',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share saved products',profileVersion:4,preparationModel:'both',offeringCategoryId:'fashion.apparel',productsServices:'Owner products',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'engineering-a',productId:'offer-a',name:'Exact jacket',description:'Saved jacket description',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:true,fulfilment:{methods:['collection']},presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'exact-medium',selection:{size:'M'},availability:'limited',pricing:{mode:'fixed',currency:'GBP',amount:91},future:'retained'}],future:'retained'}}]};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);res.end();return;}}req.body=raw?JSON.parse(raw):{};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 if(url.pathname==='/api/businesses')return await list(req,res);
 let match=url.pathname.match(/^\/api\/businesses\/([^/]+)(?:\/campaigns\/([^/]+))?$/);
 if(match){req.query.businessId=decodeURIComponent(match[1]);if(match[2]){req.query.campaignId=decodeURIComponent(match[2]);return await campaign(req,res);}return await business(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)\/media$/);if(match){req.query.businessId=match[1];return await media(req,res);}
 if(url.pathname==='/api/customer/checkout')return await checkout(req,res);
 if(url.pathname==='/api/generate')return await generatorModule.exports(req,res);
 if(url.pathname==='/api/customer/work')return await publicWork(req,res);
 if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Not configured'});
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/business-workspace.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});
(async()=>{
 await database.ensureSchema();await repository.createBusinessForOwner('owner-a',profile);await repository.createBusinessForOwner('owner-b',{...profile,businessId:'engineering-b',name:'Private Owner B',products:[]});await repository.saveBusinessMediaAsset(profile.businessId,asset);await repository.saveBusinessMediaAsset(profile.businessId,{...asset,assetId:'engineering-video',kind:'video',contentType:'video/mp4',deliveryUrl:'https://example.org/exact.mp4'});await repository.saveCampaign({id:'legacy-private',businessId:profile.businessId,campaignText:'Existing normal campaign',campaignType:'social',campaignTypeLabel:'Social Media Campaign',businessName:profile.name,createdAt:new Date().toISOString(),approvalStatus:'Unapproved'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.DEMEOS_BROWSER_CHANNEL?{channel:process.env.DEMEOS_BROWSER_CHANNEL}:{})});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   await repository.saveBusiness(profile);
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});await context.addCookies([{name:'engineering-owner',value:'owner-a',url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:"window.Clerk={user:sessionStorage.getItem('signed-out')?null:{id:'owner-a'},session:null,async load(){},addListener(fn){this.listener=fn;},openSignIn(){},async signOut(){sessionStorage.setItem('signed-out','1');this.user=null;this.listener({user:null});}};"}));
   await context.route('https://example.org/**',r=>r.request().url().endsWith('.mp4')?r.fulfill({contentType:'video/mp4',body:fs.readFileSync(path.join(root,'images/controlled-test/garden-wildlife.mp4'))}):r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(root,'images/controlled-test/mens-fashion.webp'))}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',dialog=>dialog.accept());
   // Render the exact earlier PR head against the same isolated owner and SQL data before comparing.
   for(const [file,body] of baselineFiles)await context.route(base+'/'+file,r=>r.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body}));
   await page.goto(base+'/business-workspace.html');await page.locator('#workspace-business-identity').filter({hasText:'Engineering Owner A'}).waitFor();
   const before={navigation:await page.locator('.owner-workspace-navigation').boundingBox(),identity:await page.locator('#workspace-business-identity').boundingBox(),nextAction:await page.locator('#workspace-next-action a').boundingBox()};
   await page.screenshot({path:'/tmp/demeos-owner-before-first-screen-'+viewport.width+'.png'});
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-before-overview-'+viewport.width+'.png'});
   for(const [file] of baselineFiles)await context.unroute(base+'/'+file);
   await page.reload();await page.locator('#workspace-business-identity').filter({hasText:'Engineering Owner A'}).waitFor();
   const after={navigation:await page.locator('.owner-workspace-navigation').boundingBox(),identity:await page.locator('#workspace-business-identity').boundingBox(),nextAction:await page.locator('#workspace-next-action a').boundingBox(),activity:await page.locator('#current-work-heading').boundingBox()};
   if(viewport.width<=980)assert.ok(after.navigation.height<=64,'Five areas use one compact navigation row: '+JSON.stringify(after.navigation));
   assert.ok(after.identity.y+after.identity.height<viewport.height,'Business identity and accurate approval status fit the first screen');
   assert.ok(after.nextAction.y+after.nextAction.height<viewport.height,'The next useful action fits the first screen');
   assert.ok(after.activity.y+after.activity.height<viewport.height,'Relevant activity is visible on the first screen');
   if(viewport.width===390){assert.ok(before.nextAction.y>viewport.height,'The earlier design buried the next action');assert.ok(after.navigation.height<before.navigation.height/2,'Navigation no longer dominates mobile');}
   assert.equal(await page.locator('.owner-overview-summary .demeos-primary-button').count(),1);
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('#owner-overview-heading').innerText(),'Overview');
   assert.match(await page.locator('#workspace-business-identity').innerText(),/Private preparation. Business approval is not recorded/);
   await page.screenshot({path:'/tmp/demeos-owner-after-first-screen-'+viewport.width+'.png'});
   for(const link of await page.locator('.owner-workspace-navigation a').all()){
    const box=await link.boundingBox();assert.ok(box.height>=44&&box.height<=60,'Navigation has compact accessible touch targets: '+JSON.stringify({box,label:await link.innerText()}));
    await link.focus();const focused=await link.boundingBox();assert.ok(focused.x>=0&&focused.x+focused.width<=viewport.width,'Keyboard focus reveals each navigation destination: '+JSON.stringify({focused,viewport,label:await link.innerText()}));
   }
   assert.equal(await page.locator('footer .owner-public-destination').getAttribute('href'),'customer.html');
   await page.screenshot({path:'/tmp/demeos-owner-after-first-screen-'+viewport.width+'.png'});
   fs.writeFileSync('/tmp/demeos-owner-layout-'+viewport.width+'.json',JSON.stringify({baseline:designBaseline,viewport,before,after},null,2));
   assert.equal(await page.locator('.owner-workspace-navigation [data-owner-section]').count(),5);
   assert.equal((await context.request.get(base+'/api/businesses/engineering-b')).status(),403);
   assert.equal((await context.request.post(base+'/api/generate',{data:{businessId:'engineering-b',preparationMode:'business-facts',productId:'offer-a'}})).status(),403);
   assert.equal((await context.request.get(base+'/api/businesses/engineering-b/media')).status(),403);
   assert.equal((await context.request.post(base+'/api/businesses/engineering-a/media',{data:{asset:{kind:'image',purpose:'product',relatedEntityId:'foreign',contentType:'image/png',sizeBytes:100}}})).status(),409);
   const endpoint=base+'/api/businesses/engineering-a';
   const modelStates=[
    ['marketing-only',{marketing:{canPrepare:true},selling:{canPrepare:false}},'marketing','ready'],
    ['selling-preparation',{marketing:{canPrepare:false},selling:{canPrepare:true,canSell:false}},'selling','ready'],
    ['dual',{marketing:{canPrepare:true},selling:{canPrepare:true,canSell:false}},'marketing','ready'],
    ['pending',{marketing:{},selling:{},onboarding:{status:'submitted'}},null,'pending'],
    ['denied',{marketing:{canPrepare:false},selling:{canPrepare:false}},null,'denied'],
    ['missing-readiness',null,null,'unavailable'],
    ['malformed',{marketing:{canPrepare:'true'},selling:{canPrepare:1}},null,'unavailable'],
    ['foreign',{businessId:'engineering-b',marketing:{canPrepare:true},selling:{canPrepare:true}},null,'unavailable'],
    ['failed',503,null,'unavailable'],['forbidden',403,null,'forbidden']
   ];
   for(const [name,ready,model,status] of modelStates){
    await page.evaluate(()=>sessionStorage.removeItem('demeosOwnerView:engineering-a'));
    await context.route(endpoint,async route=>{
      if(typeof ready==='number')return route.fulfill({status:ready,json:{error:'Isolated readiness read failure'}});
      const response=await route.fetch(),record=await response.json(); record.workspaceReadiness=ready?{businessId:'engineering-a',...ready}:null;
      await route.fulfill({response,json:record});
    });
    await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-access="'+status+'"]').waitFor();
    assert.equal(await page.locator('body').getAttribute('data-owner-model'),model||'none');
    assert.equal(await page.locator('.owner-model-switch').count(),name==='dual'?1:0);
    if(model==='marketing'){
      assert.equal(await page.locator('[data-owner-section="marketing"]').count(),1);
      assert.equal(await page.locator('[data-owner-section="product-options"]').count(),0);
      assert.equal(await page.locator('#owner-selling-dependencies').isVisible(),false);
      await page.locator('[data-owner-section="products"]').click();await page.locator('#products:not([hidden])').waitFor();
      assert.equal(await page.locator('#business-products-list').filter({hasText:'Exact jacket'}).count(),1);
      await page.goto(base+'/marketing.html#product-options');await page.locator('body[data-owner-access="ready"]').waitFor();
      // Product options are shared factual catalogue fields, never a stock or selling operation.
      assert.equal(await page.locator('[data-owner-section="product-options"]').count(),0);
      assert.equal((await context.request.post(base+'/api/businesses/engineering-a/orders',{data:{}})).status(),404);
      assert.equal((await context.request.post(base+'/api/businesses/engineering-a/inventory',{data:{}})).status(),404);
    }
    if(model){
      const payment=await context.request.post(base+'/api/customer/checkout?demeos-test=1',{headers:{'x-demeos-test-mode':'controlled-preview',origin:base},data:{draft:{businessId:'engineering-a',selling:true},details:{}}});
      assert.equal(payment.status(),403);assert.equal((await payment.json()).reason,'customer-only');
      assert.deepEqual((await (await context.request.get(base+'/api/customer/work')).json()).work,[]);
    }
    if(model==='selling'){
      assert.equal(await page.locator('[data-owner-section="marketing"]').count(),0);
      assert.equal(await page.locator('[data-owner-section="results"]').count(),0);
      assert.equal(await page.locator('[data-owner-section="product-options"]').count(),1);
      assert.equal(await page.locator('#owner-selling-dependencies').isVisible(),true);
      await page.locator('[data-owner-section="product-options"]').click();await page.locator('#products:not([hidden])').waitFor();
      await page.locator('#business-products-list button').filter({hasText:'Edit'}).first().click();
      assert.equal(await page.locator('.owner-variant legend').first().innerText(),'Medium');
      assert.equal(await page.getByRole('button',{name:'Prepare marketing',exact:true}).isVisible(),false);
      assert.equal(await page.locator('.business-media-manager').isVisible(),false);
      assert.equal(await page.locator('#business-product-description').isVisible(),false);
      await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-selling-options-'+viewport.width+'.png'});
      await page.goto(base+'/marketing.html#create');await page.locator('body[data-owner-model=selling]').waitFor();
      assert.equal(await page.locator('#create').isVisible(),false);assert.equal(new URL(page.url()).hash,'#business-profile');
      await page.goto(base+'/business-results.html');await page.locator('body[data-owner-model=selling]').waitFor();
      assert.equal(await page.locator('#owner-results-metrics').isVisible(),false);assert.equal(await page.locator('#owner-results-unavailable').isVisible(),true);
    }
    if(name==='dual'){
      await page.goto(base+'/business-workspace.html');await page.locator('.owner-model-switch').waitFor();
      await page.locator('.owner-model-switch [data-owner-model=selling]').click();await page.locator('body[data-owner-model=selling]').waitFor();
      assert.equal(await page.locator('[data-owner-section="marketing"]').count(),0);
      await page.locator('[data-owner-section="products"]').click();await page.locator('body[data-owner-model=selling]').waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('demeosActiveBusinessId')),'engineering-a');
      await page.locator('.owner-model-switch [data-owner-model=marketing]').click();await page.locator('body[data-owner-model=marketing]').waitFor();
      assert.equal(await page.locator('[data-owner-section="marketing"]').count(),1);
    }
    if(!model){assert.equal(await page.locator('.owner-workspace-navigation a').count(),2);await page.goto(base+'/marketing.html#create');await page.locator('body[data-owner-access="'+status+'"]').waitFor();assert.equal(await page.locator('#create').isVisible(),false);}
    await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-access="'+status+'"]').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-workspace-'+name+'-'+viewport.width+'.png'});
    await context.unroute(endpoint);
   }
   // A failed owner list is a service error, not a new-business invitation or cache deletion.
   await page.evaluate(()=>{localStorage.setItem('demeosPendingBusinessProfileSync','["engineering-a"]');});
   const cacheBefore=await page.evaluate(()=>localStorage.getItem('demeosBusinessProfiles'));
   await context.route(base+'/api/businesses',route=>route.fulfill({status:503,json:{error:'List unavailable'}}));
   await page.goto(base+'/marketing.html#products');await page.locator('body[data-owner-access=unavailable]').waitFor();
   assert.equal(await page.locator('#products').isVisible(),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('demeosBusinessProfiles')),cacheBefore);
   assert.equal(await page.evaluate(()=>localStorage.getItem('demeosPendingBusinessProfileSync')),'["engineering-a"]');
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-workspace-list-failed-'+viewport.width+'.png'});
   await context.unroute(base+'/api/businesses');await page.evaluate(()=>localStorage.removeItem('demeosPendingBusinessProfileSync'));
   // The saved onboarding intent selects only a permitted workspace; browser facts cannot grant access.
   await repository.saveBusiness({...profile,preparationModel:'selling'});
   await page.evaluate(()=>sessionStorage.removeItem('demeosOwnerView:engineering-a'));
   await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-model=selling]').waitFor();
   await page.evaluate(()=>{localStorage.setItem('demeosBusinessProfiles',JSON.stringify([{businessId:'engineering-a',preparationModel:'marketing'}]));});
   await page.reload();await page.locator('body[data-owner-model=selling]').waitFor();
   await repository.saveBusiness(profile);
   await page.evaluate(()=>sessionStorage.removeItem('demeosOwnerView:engineering-a'));
   await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-model=marketing]').waitFor();
   const confirmed=await (await context.request.get(base+'/api/businesses/engineering-a')).json();assert.equal(confirmed.workspaceReadiness.selling.canSell,false);
   assert.equal((await context.request.get(base+'/api/customer/work')).status(),200);
   assert.equal(await page.locator('#owner-dashboard-summary .owner-metric').count(),3);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-overview-'+viewport.width+'.png'});
   await page.locator('[data-owner-section="business-profile"]').click();await page.locator('[data-owner-section="products"]').click();await page.locator('#business-products-list').filter({hasText:'Exact jacket'}).waitFor();
   assert.equal(new URL(page.url()).hash,'#products');assert.equal(await page.locator('[data-owner-section="products"]').getAttribute('aria-current'),'page');assert.equal(await page.locator('#business-product-id').count(),1);
   // Removing an offer by click must invalidate the saved onboarding review.
   assert.equal(await page.locator('#submit-business-btn').isEnabled(),true);
   await page.locator('#business-products-list').getByRole('button',{name:'Remove',exact:true}).click();
   await page.locator('[data-owner-section="business-profile"]').click();assert.equal(await page.locator('#submit-business-btn').isEnabled(),false);
   assert.match(await page.locator('#business-onboarding-status').innerText(),/Save your changes/);assert.equal((await repository.getKnownBusiness('engineering-a')).businessProfile.products.length,1);
   await page.reload();await page.locator('#submit-business-btn:enabled').waitFor();await page.locator('[data-owner-section="products"]').click();await page.locator('#business-products-list').filter({hasText:'Exact jacket'}).waitFor();
   // Fields come only from the authoritative contract; no owner mapping or selling setup.
   const categories=await page.evaluate(()=>Object.entries(DEMEOSCustomerItemContract.categories).map(([id,category])=>[id,category.fields]));
   for(const [id,fields] of categories){
    await page.locator('#owner-product-category').selectOption(id);
    assert.deepEqual(await page.locator('#owner-product-options [data-owner-field]').evaluateAll(nodes=>nodes.map(node=>node.dataset.ownerField)),fields);
    for(const field of await page.locator('#owner-product-options textarea').all())assert.equal(await field.getAttribute('required'),null);
    assert.equal(await page.locator('.owner-variant').count(),0,'Category selection never invents combinations');
    assert.equal(await page.locator('.owner-combinations').count(),fields.length?1:0);
    if(fields.length)assert.equal(await page.locator('.owner-combinations').getAttribute('open'),null,'Specific prices and availability are optional');
    assert.equal(await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Pricing',{exact:true}).inputValue(),'quote');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(['groceries.packs','services.appointments'].includes(id))await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-category-'+id.split('.')[0]+'-'+viewport.width+'.png'});
   }
   await page.locator('#owner-product-category').selectOption('');
   assert.equal(await page.locator('#owner-product-options').isHidden(),true);
   assert.match(await page.locator('#owner-category-guidance').innerText(),/No extra options are required/);
   assert.equal(await page.locator('#business-product-price-mode').isVisible(),true);await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-category-general-'+viewport.width+'.png'});
   await page.locator('#business-products-list button').filter({hasText:'Edit'}).first().click();await page.locator('#business-product-description').fill('Saved jacket description');
   assert.equal(await page.locator('#owner-product-category').isDisabled(),true);assert.equal(await page.locator('.owner-combinations').getAttribute('open'),'');assert.equal(await page.locator('.owner-variant legend').first().innerText(),'Medium');
   assert.equal(await page.locator('#business-product-fulfilment-mode').inputValue(),'specific');await page.locator('#business-product-fulfilment-mode').selectOption('business');
   await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Amount',{exact:true}).fill('95');
   await page.locator('[data-option-value="M"]').fill('Medium fit');
   const sizes=page.locator('#owner-product-options fieldset').filter({has:page.locator('legend', {hasText:'Size',exact:true})}).locator('textarea');
   await sizes.fill('M');await page.locator('#business-product-add-btn').click();assert.equal(await page.locator('#business-product-id').inputValue(),'offer-a');assert.equal((await repository.getKnownBusiness('engineering-a')).businessProfile.products[0].presentation.pricing.amount,89);
   await sizes.fill('Large');
   await page.locator('.owner-variant').getByLabel('Availability',{exact:true}).selectOption('unavailable');await page.getByRole('button',{name:'Add a specific combination',exact:true}).click();assert.equal(await page.getByLabel('Size choice',{exact:true}).inputValue(),'');await page.locator('#business-product-add-btn').click();assert.equal(await page.locator('#business-product-id').inputValue(),'offer-a');await page.getByLabel('Size choice',{exact:true}).selectOption('Large');await page.locator('.owner-variant').last().getByLabel('Availability',{exact:true}).selectOption('limited');await page.locator('#owner-product-options fieldset').filter({has:page.locator('legend',{hasText:'Colour',exact:true})}).locator('textarea').fill('Blue');for(const choice of await page.getByLabel('Colour choice',{exact:true}).all())await choice.selectOption('Blue');
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-product-editor-'+viewport.width+'.png'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#business-product-add-btn').click();
   await page.locator('#products-review-save').click();await page.locator('#business-accuracy-confirmation').check();
   const save=page.waitForResponse(r=>r.url().endsWith('/api/businesses/engineering-a')&&r.request().method()==='PUT');await page.locator('#save-business-profile-btn').click();assert.equal((await save).status(),204);
   const stored=await repository.getKnownBusiness('engineering-a');assert.equal(Object.hasOwn(stored.businessProfile.products[0],'fulfilment'),false);assert.deepEqual(stored.businessProfile.fulfilment.methods,['shipping']);assert.equal(stored.businessProfile.products[0].presentation.options[0].values[0].value,'M');assert.equal(stored.businessProfile.products[0].productId,'offer-a');assert.equal(stored.businessProfile.products[0].presentation.pricing.amount,95);assert.equal(stored.businessProfile.products[0].presentation.variants[0].variantId,'exact-medium');assert.equal(stored.businessProfile.products[0].presentation.variants[0].availability,'unavailable');assert.equal(stored.businessProfile.products[0].presentation.variants[0].future,'retained');assert.equal(stored.businessProfile.products[0].presentation.future,'retained');assert.equal(stored.businessProfile.products[0].presentation.variants[1].selection.size,'Large');assert.equal(stored.businessProfile.products[0].presentation.variants[1].availability,'limited');assert.equal(stored.businessProfile.products[0].presentation.variants[0].selection.colour,'Blue');assert.equal(stored.businessProfile.products[0].presentation.variants[0].selection.size,'M');assert.equal(stored.businessProfile.products[0].presentation.variants[1].selection.colour,'Blue');
   await page.locator('[data-owner-section="products"]').click();
   for(const code of ['en','es','fr','ar','pt','zh','hi','de','ja']){await page.locator('#owner-preparation-language').selectOption(code);assert.equal(await page.locator('[data-owner-copy="guide"]').getAttribute('lang'),code);assert.equal(await page.locator('[data-owner-copy="guide"]').getAttribute('dir'),code==='ar'?'rtl':'ltr');assert.equal(await page.locator('[data-owner-copy="offerStage"]').getAttribute('lang'),code);assert.equal(await page.locator('[data-owner-copy="submitStage"]').getAttribute('dir'),code==='ar'?'rtl':'ltr');assert.match(await page.locator('#business-products-list').innerText(),/Exact jacket/);assert.equal(await page.locator('#owner-category-guidance').getAttribute('lang'),code);}
   await page.locator('#owner-preparation-language').selectOption('en');
   // Author a service using the same editor and save contract; no new catalogue.
   await page.locator('#business-product-name').fill('Owner consultation');await page.locator('#business-product-description').fill('Owner supplied appointment description');await page.locator('#owner-product-category').selectOption('family.toys');assert.equal(await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Pricing',{exact:true}).inputValue(),'quote');await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Pricing',{exact:true}).selectOption('fixed');await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Currency',{exact:true}).fill('EUR');await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Amount',{exact:true}).fill('40');await page.locator('#owner-product-category').selectOption('services.appointments');assert.equal(await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Amount',{exact:true}).inputValue(),'40');assert.equal(await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Currency',{exact:true}).inputValue(),'EUR');await page.locator('#owner-product-options > .owner-price-controls').getByLabel('Pricing',{exact:true}).selectOption('quote');
   await page.locator('#owner-product-options fieldset').filter({has:page.locator('legend',{hasText:'Duration',exact:true})}).locator('textarea').fill('60 minutes');await page.locator('#business-product-route').selectOption('website');await page.locator('#business-product-add-btn').click();await page.locator('#products-review-save').click();await page.locator('#business-accuracy-confirmation').check();
   const serviceSave=page.waitForResponse(r=>r.url().endsWith('/api/businesses/engineering-a')&&r.request().method()==='PUT');await page.locator('#save-business-profile-btn').click();assert.equal((await serviceSave).status(),204);
   const service=(await repository.getKnownBusiness('engineering-a')).businessProfile.products.find(p=>p.name==='Owner consultation');assert.equal(service.presentation.kind,'service');assert.equal(service.presentation.options[0].values[0].value,'60 minutes');
   assert.equal((await context.request.put(base+'/api/businesses/engineering-b',{data:{businessProfile:{...profile,businessId:'engineering-b',products:[]},ownerAccuracyConfirmed:true}})).status(),403);
   assert.equal((await context.request.post(base+'/api/businesses/engineering-a/media',{data:{asset:{kind:'image',purpose:'product',relatedEntityId:service.productId,contentType:'image/png',sizeBytes:100}}})).status(),409);
   const serviceDraft=await context.request.post(base+'/api/generate',{data:{businessId:'engineering-a',productId:service.productId,preparationMode:'business-facts'}});assert.equal(serviceDraft.status(),200);assert.match((await serviceDraft.json()).campaign,/60 minutes/);
   await page.locator('[data-owner-section="marketing"]').click();await page.locator('#overview:not([hidden])').waitFor();if(!await page.locator('[data-workspace-view="create"]').isVisible())await page.locator('#workspace-menu-toggle').click();await page.locator('[data-workspace-view="create"]').click();assert.equal(await page.locator('.owner-preparation-steps li').count(),3);assert.equal(await page.locator('#owner-preparation-language').isVisible(),true);await page.locator('#draft-product').selectOption(service.productId);await page.locator('#owner-offer-review').filter({hasText:'Owner consultation'}).waitFor();assert.equal(await page.locator('#prepare-draft-btn').isEnabled(),true);await page.locator('#prepare-draft-btn').click();await page.locator('#draft-edit-panel:not([hidden])').waitFor();assert.match(await page.locator('#draft-edit-text').inputValue(),/Duration: 60 minutes/);
   await page.locator('[data-owner-section="marketing"]').click();await page.locator('#overview:not([hidden])').waitFor();if (!await page.locator('[data-workspace-view="create"]').isVisible()) await page.locator("#workspace-menu-toggle").click();await page.locator('[data-workspace-view="create"]').click();await page.locator('#draft-product').selectOption('offer-a');await page.locator('#draft-media').selectOption('engineering-video');await page.locator('#owner-draft-media-preview video').waitFor();assert.equal(await page.locator('#owner-draft-media-preview video').evaluate(v=>v.playsInline),true);const supportsVideo=await page.locator('#owner-draft-media-preview video').evaluate(v=>v.canPlayType('video/mp4; codecs="avc1.42E01E"'));if(process.env.CI)assert.ok(supportsVideo,'Release CI must support original H264 playback');if(supportsVideo){await page.locator('#owner-draft-media-preview video').evaluate(async v=>{v.muted=true;v.load();await v.play();});await page.waitForFunction(()=>document.querySelector('#owner-draft-media-preview video').currentTime>.1);}else{await page.locator('#owner-draft-media-preview').filter({hasText:'This browser cannot preview'}).waitFor();console.log('Local codec unavailable: original video identity, inline controls and accurate preview fallback verified');}await page.locator('#draft-media').selectOption('engineering-image');await page.waitForFunction(()=>document.querySelector('#owner-draft-media-preview img').naturalWidth>0);assert.equal(await page.locator('#owner-draft-media-preview img').evaluate(i=>getComputedStyle(i).objectFit),'contain');assert.match(await page.locator('#owner-offer-review').innerText(),/95 GBP/);const original=await page.locator('#owner-draft-media-preview img').getAttribute('src');await page.locator('#owner-media-framing').selectOption('square');assert.equal(await page.locator('#owner-draft-media-preview img').getAttribute('src'),original);assert.equal(await page.locator('#owner-draft-media-preview img').evaluate(i=>getComputedStyle(i).objectFit),'contain');await page.locator('#owner-media-framing').selectOption('natural');
   const generated=page.waitForResponse(r=>r.url().endsWith('/api/generate'));await page.locator('#prepare-draft-btn').click();assert.equal((await generated).status(),200);await page.locator('#draft-edit-panel:not([hidden])').waitFor();await page.waitForFunction(()=>document.querySelector('#draft-edit-text').value.includes('Exact jacket'));
   assert.match(await page.locator('#draft-edit-text').inputValue(),/Exact jacket/);assert.match(await page.locator('#draft-edit-text').inputValue(),/95 GBP/);
   await page.locator('#draft-edit-text').fill('Owner reviewed jacket description. 95 GBP.');await page.locator('#approve-btn').click();await page.locator('#draft-edit-status').filter({hasText:'Save your draft changes'}).waitFor();await page.locator('#save-draft-edit').click();await page.locator('#draft-edit-status').filter({hasText:'Draft changes saved'}).waitFor();
   await page.locator('#approve-btn').click();await page.locator('#draft-edit-status').filter({hasText:'Submitted for review'}).waitFor();
   const latest=(await repository.getKnownBusiness('engineering-a')).campaigns.find(c=>c.preparationOnly);assert.equal(latest.approvalStatus,'Unapproved');assert.equal(latest.ownerReviewState,'submitted');assert.equal(latest.media[0].assetId,'engineering-image');
   const foreignDraft=base+'/api/businesses/engineering-b/campaigns/'+latest.id;
   // Draft reads use the owner-only business endpoint; this endpoint rejects GET.
   const unsupportedRead=await context.request.get(foreignDraft);assert.equal(unsupportedRead.status(),405);assert.doesNotMatch(await unsupportedRead.text(),/Exact jacket|Owner reviewed jacket/);
   assert.equal((await context.request.put(foreignDraft,{data:{campaign:latest}})).status(),403);
   assert.equal((await context.request.patch(foreignDraft,{data:{action:'submit-draft'}})).status(),403);
   for(const body of [{campaign:{...latest,preparationOnly:false,approvalStatus:'Approved'}},{action:'reactivate'}]){
    const response=await context.request.fetch(base+'/api/businesses/engineering-a/campaigns/'+latest.id,{method:body.action?'PATCH':'PUT',data:body});assert.equal(response.status(),409);
   }
   assert.deepEqual((await (await context.request.get(base+'/api/customer/work')).json()).work,[]);
   await repository.saveBusinessMediaAsset('engineering-a',{...asset,relatedEntityId:service.productId});assert.equal((await context.request.patch(base+'/api/businesses/engineering-a/campaigns/'+latest.id,{data:{action:'submit-draft'}})).status(),409);await repository.saveBusinessMediaAsset('engineering-a',asset);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-draft-'+viewport.width+'.png'});
   if (!await page.locator('[data-workspace-view="campaigns"]').isVisible()) await page.locator('#workspace-menu-toggle').click();
   await page.locator('[data-workspace-view="campaigns"]').click();await page.locator('.campaign-history-item').filter({hasText:'Existing normal campaign'}).getByRole('button',{name:'Open',exact:true}).click();
   // Opening an existing campaign from history must return to its receiving panel.
   await page.locator('#create:not([hidden])').waitFor();
   assert.equal(await page.locator('#draft-edit-panel').isVisible(),false);assert.equal(await page.locator('#revise-btn').isVisible(),true);assert.equal(await page.locator('#revision-instruction').isVisible(),true);

   await page.locator('[data-owner-section="results"]').click();await page.locator('#owner-results-metrics .owner-metric').first().waitFor();assert.equal(await page.locator('#owner-results-metrics .owner-metric').count(),5);assert.match(await page.locator('#owner-results-metrics').innerText(),/Not recorded/);assert.doesNotMatch(await page.locator('body').innerText(),/Private Owner B|owner-a|owner-b/);
   if(viewport.width<=980)assert.ok((await page.locator('.owner-workspace-navigation').boundingBox()).height<=64);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-results-'+viewport.width+'.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   await page.locator('#owner-sign-out').click();await page.locator('#owner-auth-signed-out:not([hidden])').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/Engineering Owner A|Exact jacket/);assert.deepEqual(errors,[]);
   await context.clearCookies();await page.goto(base+'/business-workspace.html');await page.locator('#owner-auth-signed-out:not([hidden])').waitFor();
   assert.equal(await page.locator('#owner-operating-models').isVisible(),false);assert.equal((await context.request.get(base+'/api/businesses/engineering-a')).status(),401);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-models-unauthorised-'+viewport.width+'.png'});
   await context.close();console.log('Owner SQL, model permissions, product/media, factual draft, private submission, results and sign-out passed',viewport.width);
  }
  // New owner onboarding exercises the actual existing profile, ownership SQL and APIs.
  for(const width of [390,820,1440]){
   const owner='owner-new-'+width,context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   await context.addCookies([{name:'engineering-owner',value:owner,url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Clerk={user:{id:'+JSON.stringify(owner)+'},session:null,async load(){},addListener(fn){this.listener=fn},openSignIn(){throw Error("Duplicate sign in")},async signOut(){this.user=null;this.listener({user:null})}};'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
   await page.goto(base+'/business-workspace.html');await page.locator('body[data-owner-access=setup]').waitFor();await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-workspace-missing-business-'+width+'.png'});await page.getByRole('link',{name:'Start business setup',exact:true}).click();
   await page.locator('#owner-authenticated-workspace:not([hidden])').waitFor();await page.locator('#business-offering-category option').last().waitFor({state:'attached'});
   assert.equal(await page.locator('#submit-business-btn').isEnabled(),false);
   assert.equal((await context.request.put(base+'/api/businesses/not-created',{data:{action:'submit-business',ownerAccuracyConfirmed:true}})).status(),403);
   await page.locator('#business-name').fill('Isolated onboarding '+width);await page.locator('#business-type').fill('Clothing');await page.locator('#business-location').fill('London');await page.locator('#business-products-services').fill('Owner supplied clothing');await page.locator('#business-offering-category').selectOption('fashion.apparel');
   await page.locator('#onboarding-preparation summary').click();await page.locator('#business-preparation-model').selectOption('both');await page.locator('#business-route-website').check();await page.locator('#business-website').fill('https://example.org/shop');await page.locator('#business-fulfilment-shipping').check();
   await page.locator('#onboarding-marketing summary').click();await page.locator('#business-brand-voice').fill('Clear');await page.locator('#business-target-customer').fill('Local customers');await page.locator('#business-goal').fill('Share genuine offers');
   await page.locator('#onboarding-review summary').click();await page.locator('#business-accuracy-confirmation').check();
   const created=page.waitForResponse(r=>r.request().method()==='PUT'&&/api\/businesses\//.test(r.url()));await page.locator('#save-business-profile-btn').click();assert.equal((await created).status(),204);
   await page.locator('#submit-business-btn:enabled').waitFor();const businessId=await page.evaluate(()=>localStorage.getItem('demeosActiveBusinessId'));
   let record=await repository.getKnownBusiness(businessId);assert.equal(record.businessProfile.offeringCategoryId,'fashion.apparel');assert.equal(record.businessProfile.preparationModel,'both');assert.equal(record.businessProfile.products.length,0);
   assert.equal((await context.request.get(base+'/api/businesses/engineering-a')).status(),403);
   assert.equal((await context.request.put(base+'/api/businesses/engineering-a',{data:{businessProfile:profile,ownerAccuracyConfirmed:true}})).status(),403);
   assert.equal((await context.request.put(base+'/api/businesses/engineering-a',{data:{action:'submit-business',ownerAccuracyConfirmed:true,reviewedProfile:profile}})).status(),403);
   const before=record.businessProfile;const body={action:'submit-business',ownerAccuracyConfirmed:true,reviewedProfile:before};
   assert.equal((await context.request.put(base+'/api/businesses/'+businessId,{data:{...body,reviewedProfile:{...before,name:'Wrong snapshot'}}})).status(),409);
   // Keep the unchanged reviewed profile retryable through server errors and lost success responses.
   await page.locator('#business-accuracy-confirmation').check();
   const submitUrl=base+'/api/businesses/'+businessId;
   await page.route(submitUrl,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test failure'})}),{times:1});
   await page.locator('#submit-business-btn').click();await page.locator('#business-onboarding-status').filter({hasText:'Could not submit'}).waitFor();assert.equal(await page.locator('#submit-business-btn').isEnabled(),true);
   assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.informationStatus.reviewState,undefined);
   await page.route(submitUrl,async route=>{assert.equal((await route.fetch()).status(),200);await route.abort('failed');},{times:1});
   await page.locator('#submit-business-btn').click();await page.waitForFunction(()=>!document.getElementById('submit-business-btn').disabled&&document.getElementById('business-onboarding-status').textContent.includes('Could not submit'));
   const ambiguousStamp=(await repository.getKnownBusiness(businessId)).businessProfile.informationStatus.submittedAt;assert.ok(ambiguousStamp);
   await page.locator('#business-accuracy-confirmation').check();const submitted=page.waitForResponse(r=>r.request().postDataJSON()?.action==='submit-business');await page.locator('#submit-business-btn').click();assert.equal((await submitted).status(),200);await page.locator('#business-onboarding-status').filter({hasText:'Submitted privately'}).waitFor();
   record=await repository.getKnownBusiness(businessId);assert.equal(record.businessProfile.informationStatus.reviewState,'submitted');const stamp=record.businessProfile.informationStatus.submittedAt;assert.equal(stamp,ambiguousStamp);assert.equal((await context.request.put(base+'/api/businesses/'+businessId,{data:body})).status(),200);
   assert.equal((await context.request.put(base+'/api/businesses/'+businessId,{data:{...body,reviewedProfile:record.businessProfile}})).status(),200);assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.informationStatus.submittedAt,stamp);
   const readiness=(await (await context.request.get(base+'/api/businesses/'+businessId)).json()).workspaceReadiness;assert.equal(readiness.selling.canSell,false);assert.equal(readiness.onboarding.approved,false);assert.equal(readiness.publication.draftsPublic,false);
   assert.deepEqual((await (await context.request.get(base+'/api/customer/work')).json()).work,[]);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-onboarding-'+width+'.png'});
   for(const code of ['en','es','fr','ar','pt','zh','hi','de','ja']){await page.locator('#owner-preparation-language').selectOption(code);assert.equal(await page.locator('[data-onboarding-copy="title"]').getAttribute('lang'),code);assert.equal(await page.locator('#business-offering-category').inputValue(),'fashion.apparel');assert.equal(await page.locator('#business-name').inputValue(),'Isolated onboarding '+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.locator('#owner-preparation-language').selectOption('en');await page.getByRole('link',{name:'Return to Overview',exact:true}).click();await page.locator('#workspace-business-identity').filter({hasText:'Submitted privately'}).waitFor();
   await page.locator('[data-owner-section="business-profile"]').click();await page.locator('#business-onboarding-status').filter({hasText:'Submitted privately'}).waitFor();assert.equal(await page.locator('#business-offering-category').inputValue(),'fashion.apparel');assert.equal(await page.locator('#submit-business-btn').isEnabled(),false);
   await page.locator('#business-name').fill('Revised isolated onboarding');assert.equal(await page.locator('#submit-business-btn').isEnabled(),false);await page.locator('#business-accuracy-confirmation').check();const edited=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(businessId));await page.locator('#save-business-profile-btn').click();assert.equal((await edited).status(),204);await page.locator('#submit-business-btn:enabled').waitFor();assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.informationStatus.reviewState,'draft');
   assert.deepEqual(errors,[]);await context.close();console.log('Actual isolated new-owner onboarding, snapshot review, submission, navigation and nine languages passed',width);
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await client.close();}
})().catch(e=>{console.error(e);process.exit(1);});
