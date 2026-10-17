'use strict';
// Exercises the shipped dashboard and API against real isolated SQL. The only
// adapters are the identity provider and test server; there is no test UI/API.
const {chromium,webkit}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard');
const {sections}=require('../js/selling-dashboard');
const {diskStorage}=require('./support/private-object-store');
const root=path.resolve(__dirname,'..'),artifacts=process.env.DEMEOS_BROWSER_ARTIFACT_DIR||'/tmp';
async function verifyBusinessLayout(page,viewport){
 const boxes=await page.evaluate(()=>{
  const bar=document.querySelector('.business-bar'),group=bar.querySelector(':scope > div'),title=bar.querySelector('h2'),badge=bar.querySelector('.badge'),label=bar.querySelector('label'),select=bar.querySelector('select');
  const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
  return {bar:rect(bar),group:rect(group),title:rect(title),badge:rect(badge),label:rect(label),select:rect(select),fontSize:parseFloat(getComputedStyle(title).fontSize),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.equal(boxes.overflow,false,'Business information must not overflow the page');
 assert.ok(boxes.title.width>=Math.min(250,viewport.width-40),'Business name has enough width for whole words');
 if(viewport.width<=760){
  assert.ok(Math.abs(boxes.group.width-boxes.bar.width)<=1,'Business identity uses the full mobile row');
  assert.ok(boxes.badge.y>=boxes.group.bottom,'Status follows the business identity on its own row');
  assert.ok(boxes.label.y>=boxes.badge.bottom,'Business selector follows the status on its own row');
  assert.ok(Math.abs(boxes.select.width-boxes.bar.width)<=1,'Business selector uses the full mobile row');
  assert.ok(boxes.title.height<=boxes.fontSize*3.5,'Business name must not wrap almost letter by letter');
 }else if(viewport.width>=1440) assert.ok(boxes.label.x>boxes.group.x,'Wide desktop retains the side-by-side business selector');
 assert.ok(boxes.title.height<=boxes.fontSize*3.5,'Business name stays readable at intermediate desktop widths too');
}
async function verifyLogo(page,repository,businessId){
 const bytes=await require('sharp')({create:{width:40,height:28,channels:3,background:'#b89b55'}}).png().toBuffer();
 for(const name of ['logo.png','replacement.png']){
  await page.locator('#logo-file').setInputFiles({name,mimeType:'image/png',buffer:bytes});
  await page.locator('#logo-upload').click();await page.locator('#logo-feedback').filter({hasText:'Business logo saved.'}).waitFor();
  const id=(await repository.getKnownBusiness(businessId)).businessProfile.logoAssetId;assert.ok(id);
  assert.equal((await repository.getBusinessMediaAsset(businessId,id)).purpose,'brand');
  await page.reload();await page.locator('#business-logo:visible').waitFor();
  assert.ok(await page.locator('#business-logo').evaluate(image=>image.complete&&image.naturalWidth>0),'Saved logo decodes after refresh');
  if(name==='replacement.png')await page.screenshot({path:path.join(artifacts,'demeos-selling-logo-'+businessId+'-'+page.viewportSize().width+'.png'),fullPage:true});
 }
 page.once('dialog',dialog=>dialog.accept());await page.locator('#logo-remove').click();await page.locator('#logo-feedback').filter({hasText:'Business logo saved.'}).waitFor();
 await page.reload();await page.locator('#business-form:visible').waitFor();assert.equal(await page.locator('#business-logo:visible').count(),0);assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.logoAssetId,undefined);
}
async function run(){
 process.env.DEMEOS_MEDIA_UPLOAD_SECRET='browser-upload-secret-at-least-thirty-two-characters';
 const disk=await diskStorage({blobProtocol:true});
 const client=new PGlite(),database=createDatabase(client),repository=createPersistenceRepository(database,{environment:()=>env});
 const profile=(businessId,selling=true)=>({businessId,name:businessId==='vendor-a'?'North & Field':'Business '+businessId,type:'Independent shop',location:'London',applicationAccess:{selling,marketing:true},products:[],preparationModel:'selling'});
 await repository.createBusinessForOwner('owner-a',profile('vendor-a'));
 await repository.createBusinessForOwner('owner-a',profile('vendor-a-second'));
 await repository.createBusinessForOwner('owner-a',profile('pending',false));
 await repository.createBusinessForOwner('owner-a',{...profile('test-business-selling-a',false),name:'DEMEOS Test Vendor',applicationAccess:undefined});
 await repository.createBusinessForOwner('owner-b',profile('vendor-b'));
 let env={VERCEL_ENV:'production'},failure=false,delay=0,submissionEvidence;
 const reviewedFixtureEvidence=async request=>({...request,outcome:'passed',independentlyVerified:true,authorityDecisionId:'isolated-browser-authority-fixture',capabilityVersion:'fixture-v1',expiresAt:new Date(Date.now()+3600000).toISOString()});
 // A genuine reservation from the existing service in isolated SQL, not a fabricated order row.
 const orderInventory=require('../api/_lib/vendor-inventory');
 const orderProfile={...profile('vendor-b'),products:[{businessId:'vendor-b',productId:'order-shirt',name:'Reserved Shirt',availability:'available',presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:20},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'medium',selection:{size:'M'},availability:'available'}]}}]};
 await repository.saveBusiness(orderProfile);
 const orderStock=orderInventory.applyChanges(orderProfile,{},[{productId:'order-shirt',variantId:'medium',onHand:5,lowStock:1,sku:'ORDER-M',reason:'Private order fixture'}]);
 await repository.saveVendorInventory('owner-b','vendor-b',orderProfile,0,orderStock.entries,orderStock.audit);
 const orderService=require('../api/_lib/vendor-orders').createVendorOrders(database,{authorizePurchase:()=>true});
 const orderSnapshot=(await repository.getKnownBusiness('vendor-b')).businessProfile;
 const genuineOrder=await orderService.reserve('order-customer','browser-order-000001',{businessId:'vendor-b',productId:'order-shirt',variantId:'medium',selection:{size:'M'},quantity:2,catalogueRevision:orderInventory.catalogueRevision(orderSnapshot),stockIdentity:orderInventory.stockIdentity(orderProfile.products[0],orderProfile.products[0].presentation.variants[0])});

 const handler=createHandler({resolveSubmissionEvidence:request=>submissionEvidence?submissionEvidence(request):null,repository:()=>repository,environment:()=>({...env,DEMEOS_MEDIA_UPLOAD_SECRET:process.env.DEMEOS_MEDIA_UPLOAD_SECRET}),mediaBackend:()=>disk,authenticate:async req=>{
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(failure)throw Error('Simulated data boundary failure');
  const id=req.headers.cookie?.match(/gate-owner=(owner-[a-z]+)/)?.[1];return id?{trustedIdentityId:id}:null;
 }});
 // WebKit does not expose Blob PUT bodies through intercepted request.postDataBuffer().
 // Receive the browser's actual bytes over a separate loopback HTTP origin instead.
 let refuseUploads=false;
 const uploadServer=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','PUT,OPTIONS');res.setHeader('Access-Control-Allow-Headers','content-type,x-content-type,x-vercel-blob-access');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  if(req.method!=='PUT'){res.statusCode=405;return res.end();}
  if(refuseUploads){res.statusCode=403;return res.end('Upload refused');}
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>15*1024*1024){res.statusCode=413;return res.end();}chunks.push(chunk);}
   const response=await disk.fetchImpl('https://storage.gate'+req.url,{method:'PUT',headers:{'Content-Type':req.headers['content-type'],'x-content-type':req.headers['x-content-type'],'x-vercel-blob-access':req.headers['x-vercel-blob-access']},body:Buffer.concat(chunks)});
   res.statusCode=response.status;res.end();
  }catch(error){console.error(error);res.statusCode=500;res.end();}
 });
 await new Promise(r=>uploadServer.listen(0,'127.0.0.1',r));
 const uploadBase='http://127.0.0.1:'+uploadServer.address().port;
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
  res.status=code=>{res.statusCode=code;return res;};res.json=body=>{if(body.uploadSession?.uploadUrl?.startsWith('https://storage.gate/'))body={...body,uploadSession:{...body.uploadSession,uploadUrl:body.uploadSession.uploadUrl.replace('https://storage.gate',uploadBase)}};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};
  if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
  if(url.pathname==='/api/businesses'){
   if(req.method==='POST'){
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)return res.status(413).json({error:'Payload too large'});}
    try{req.body=JSON.parse(raw);}catch{return res.status(400).json({error:'Invalid JSON'});}
   }
   return handler(req,res);
  }
  if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Unknown API'});
  let file=url.pathname;
  if(file==='/selling-vendor'||/^\/selling-vendor\/(overview|my-business|product-catalogue|images-videos|options-variants|stock-history|private-orders)\/?$/.test(file))file='/selling-dashboard.html';
  const target=path.resolve(root,'.'+file);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
 }catch(error){console.error(error);res.statusCode=500;res.end('{}');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  const engine=process.env.DEMEOS_BROWSER_ENGINE==='webkit'?webkit:chromium;
  browser=await engine.launch({headless:true,...(process.env.DEMEOS_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.DEMEOS_BROWSER_EXECUTABLE_PATH}:{}),...(engine===chromium&&process.env.DEMEOS_BROWSER_CHANNEL?{channel:process.env.DEMEOS_BROWSER_CHANNEL}:{})});
  for(const viewport of [{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:761,height:1000},{width:820,height:1180},{width:1024,height:1366},{width:1280,height:1000},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport});
   await context.route('https://storage.gate/**',async route=>{const request=route.request();if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'content-type,x-content-type,x-vercel-blob-access'}});const response=await disk.fetchImpl(request.url(),{method:request.method(),headers:{'Content-Type':request.headers()['content-type'],'x-content-type':request.headers()['x-content-type'],'x-vercel-blob-access':request.headers()['x-vercel-blob-access']},body:request.method()==='PUT'?request.postDataBuffer():undefined});await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(await response.arrayBuffer())});});context.setDefaultTimeout(10000);
   console.log('Browser gate: starting '+viewport.width+'px viewport');
   await context.addCookies([{name:'gate-owner',value:'owner-a',url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:`window.Clerk={user:{id:document.cookie.match(/gate-owner=(owner-[a-z]+)/)?.[1]||'owner-a'},session:{id:'session-a',async getToken(){return 'verified-token';}},async load(options){window.loadedAuthLocale=options.localization?.locale;},__internal_updateProps(value){window.updatedAuthLocale=value.options.localization.locale;},addListener(fn){this.listener=fn;},openSignIn(options){window.signInRequest=options;},async signOut(){this.user=null;this.session=null;this.listener();}};`}));
   const page=await context.newPage(),errors=[],failedRequests=[];
   page.on('requestfailed',request=>{const failed={url:request.url(),error:request.failure()?.errorText||''};failedRequests.push(failed);console.log('Browser request failed: '+JSON.stringify(failed));});
   page.on('pageerror',e=>{const error={name:e.name,message:e.message,stack:e.stack||'',page:page.url()};errors.push(error);console.log('Browser page error: '+JSON.stringify(error));});
   async function submissionJourney(businessId){
    const current=()=>repository.getKnownBusiness(businessId).then(r=>r.businessProfile.products[0]);
    let product=await current();const id=product.productId;
    // Real multiple-file main-image selection, then remove the additional file.
    const originalMain=product.mediaGallery.mainAssetId;
    await page.locator('#media-file').setInputFiles({name:'alternate.png',mimeType:'image/png',buffer:await require('sharp')({create:{width:18,height:14,channels:3,background:'#c99a2e'}}).png().toBuffer()});
    await page.locator('#media-upload').click();await page.locator('#media-feedback').filter({hasText:'File uploaded and linked to product.'}).waitFor();
    product=await current();const alternate=product.mediaGallery.assetIds.find(assetId=>assetId!==originalMain);
    const alternateCard=page.locator('#media-list article').filter({has:page.locator('[data-main-asset="'+alternate+'"]')});
    await alternateCard.getByRole('button',{name:'Move earlier',exact:true}).click();await page.locator('#media-feedback').filter({hasText:'Saved and verified.'}).waitFor();
    assert.equal((await current()).mediaGallery.assetIds[0],alternate,'Media ordering persists through SQL');
    await page.locator('[data-main-asset="'+alternate+'"]').click();await page.locator('#media-feedback').filter({hasText:'Saved and verified.'}).waitFor();
    await page.reload();await page.locator('[data-main-asset="'+alternate+'"]').waitFor();assert.equal((await current()).mediaGallery.mainAssetId,alternate);
    page.once('dialog',dialog=>dialog.accept());await page.locator('#media-list article').filter({has:page.locator('[data-main-asset="'+alternate+'"]')}).getByRole('button',{name:'Remove',exact:true}).click();await page.locator('#media-feedback').filter({hasText:'Media removed from product.'}).waitFor();
    await page.locator('[data-main-asset="'+originalMain+'"]').click();await page.locator('#media-feedback').filter({hasText:'Saved and verified.'}).waitFor();
    assert.equal((await current()).mediaGallery.mainAssetId,originalMain);

    await page.goto(base+'/selling-vendor/product-catalogue?businessId='+businessId);
    await page.locator('.catalogue-item > button').filter({hasText:'Edit',exact:true}).click();
    await page.locator('#product-category').selectOption('1');await page.locator('#product-save').click();await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();
    await page.locator('[data-submission="'+id+'"] > summary').click();
    await page.locator('[data-review-product="'+id+'"]').click();await page.locator('#submission-feedback').filter({hasText:'Draft'}).waitFor();
    await page.locator('[data-submission-confirm="'+id+'"]').check();await page.locator('[data-submit-product="'+id+'"]').click();
    await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Review required'}).waitFor();
    product=await current();assert.equal(product.submission.state,'review-required');assert.equal(product.customerVisible,false);
    assert.equal(product.submission.validation.rules.find(r=>r.id==='content-safety').status,'unavailable');
    await page.reload();await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Review required'}).waitFor();
    if(viewport.width===375){await page.locator('#dashboard-language').selectOption('tr');await page.locator('[data-product-state="'+id+'"]').filter({hasText:'İnceleme gerekli'}).waitFor();assert.equal(await page.locator('[data-submission-copy=saveDraft]').innerText(),'Taslağı kaydet');await page.locator('#dashboard-language').selectOption('en');}
    await page.locator('[data-submission="'+id+'"] > summary').click();
    if(viewport.width===375||viewport.width===1440)await page.screenshot({path:path.join(artifacts,'demeos-selling-submission-held-'+businessId+'-'+viewport.width+'.png'),fullPage:true});
    // Only the isolated server fixture can install exact-purpose receipts. No HTTP parameter does this.
    submissionEvidence=reviewedFixtureEvidence;
    await page.locator('[data-review-product="'+id+'"]').click();
    await page.locator('#submission-feedback').filter({hasText:'Review required'}).waitFor();
    await page.locator('[data-submission-confirm="'+id+'"]').check();await page.locator('[data-submit-product="'+id+'"]').click();
    await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Approved'}).waitFor();
    await page.locator('[data-publish-product="'+id+'"]').click();await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Published'}).waitFor();
    const publication=(await current()).submission.publication;assert.equal(publication.version,(await current()).submission.version);assert.equal((await current()).customerVisible,false);
    await page.reload();await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Published'}).waitFor();
    await page.locator('[data-submission="'+id+'"] > summary').click();
    if(viewport.width===375||viewport.width===1440)await page.screenshot({path:path.join(artifacts,'demeos-selling-submission-'+businessId+'-'+viewport.width+'.png'),fullPage:true});
    await page.locator('[data-unpublish-product="'+id+'"]').click();
    await page.locator('[data-product-state="'+id+'"]').filter({hasText:'Approved'}).waitFor();assert.equal((await current()).submission.publication.state,'revoked');
    submissionEvidence=null;
    await page.goto(base+'/selling-vendor/images-videos?businessId='+businessId);await page.locator('#media-form:visible').waitFor();
   }
   async function verifyDemeosIdentity(){
    const brand=await page.evaluate(()=>{
     const logo=document.querySelector('header .brand img');
     return {source:logo.getAttribute('src'),loaded:logo.complete&&logo.naturalWidth>0,ink:getComputedStyle(document.documentElement).backgroundColor,accent:getComputedStyle(document.querySelector('nav [aria-current=page]')).color,shared:!!document.querySelector('link[href="/css/demeos-business-premium.css"]')};
    });
    assert.equal(brand.source,'/images/demeos-logo.png');assert.equal(brand.loaded,true,'Existing DEMEOS logo loads');
    assert.equal(brand.shared,true,'Uses the existing DEMEOS business design tokens');
    assert.equal(brand.ink,'rgb(2, 11, 24)','DEMEOS ink background');
    assert.equal(brand.accent,'rgb(240, 207, 114)','DEMEOS gold active navigation');
   }
   await page.goto(base+'/selling-vendor');await page.locator('#private-workspace:not([hidden])').waitFor();
   assert.equal(await page.locator('#business-select option').count(),3); // placeholder + two approved live businesses
   assert.equal(await page.locator('#business-name').innerText(),'Choose a business');
   await page.locator('#business-select').selectOption('vendor-a');await page.locator('#business-name').filter({hasText:'North & Field'}).waitFor();
   assert.ok(page.url().includes('businessId=vendor-a'));
   for(const [section,copy] of Object.entries(sections)){
    await page.locator('nav [data-section="'+section+'"]').click();
    await page.locator('#content-heading').filter({hasText:['product-catalogue','stock-history'].includes(section)?(section==='stock-history'?'Stock & History':'Product Catalogue'):copy[1]}).waitFor();
    assert.equal(await page.locator('nav [aria-current=page]').getAttribute('data-section'),section);
    assert.equal(await page.locator('h1').innerText(),copy[0]);
    assert.equal(await page.locator('footer.selling-footer').count(),1,'One shared footer on every workspace');
    assert.equal(await page.locator('.selling-footer p').innerText(),'© 2026 DEMEOS — ONE SYSTEM. REAL VALUE. SHARED FUTURE.');
    assert.ok(await page.locator('.selling-footer img').evaluate(image=>image.complete&&image.naturalWidth>0),'Official footer logo decodes');
    for(const href of ['/privacy.html','/terms.html','/contact.html']){assert.equal(await page.locator('.selling-footer a[href="'+href+'"]').count(),1);assert.equal((await page.request.get(base+href)).status(),200);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Shared footer fits the viewport');
    if(section==='product-catalogue'){
     assert.equal(await page.locator('#product-save').count(),1,'Catalogue has a real save action');
     assert.equal(await page.locator('#product-form').count(),1,'Catalogue has an editable form');
    }else if(section==='stock-history'){
     assert.equal(await page.locator('#stock-form:visible').count(),1,'Stock has a real adjustment form');
    }else if(section==='my-business'){
     assert.equal(await page.locator('#business-form:visible').count(),1,'Business uses permitted editing controls');
    }else if(section==='images-videos'){
     assert.equal(await page.locator('#media-empty:visible').count(),1,'Empty media tools explain the saved-product prerequisite');assert.equal(await page.locator('[data-catalogue-link]').getAttribute('href'),'/selling-vendor/product-catalogue?businessId=vendor-a');
    }else if(section==='options-variants'){
     assert.equal(await page.locator('#variant-form:visible').count(),1,'Variants has a real editor');
    }else if(section==='private-orders'){assert.equal(await page.locator('#orders-previous:disabled').count(),1);assert.equal(await page.locator('#orders-next:disabled').count(),1);assert.equal(await page.locator('#orders-list button').count(),0,'No unsupported order transitions');}else assert.equal(await page.locator('#section-content button:visible').count(),0,'No pretend tool actions');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    await page.reload();await page.locator('#content-heading').filter({hasText:['product-catalogue','stock-history'].includes(section)?(section==='stock-history'?'Stock & History':'Product Catalogue'):copy[1]}).waitFor();
    await page.goto(base+'/selling-vendor/'+section+'?businessId=vendor-a');await page.locator('#content-heading').filter({hasText:['product-catalogue','stock-history'].includes(section)?(section==='stock-history'?'Stock & History':'Product Catalogue'):copy[1]}).waitFor();
   }
   await page.goto(base+'/selling-vendor/my-business?businessId=vendor-a');await page.locator('#business-form:visible').waitFor();
   await verifyLogo(page,repository,'vendor-a');
   await page.locator('#business-edit-name').fill('North & Field Updated');await page.locator('#business-edit-location').fill('Greenwich, London');await page.locator('#business-edit-email').fill('seller@example.test');await page.locator('#business-edit-phone').fill('+44 20 7946 0123');await page.locator('#business-edit-website').fill('https://example.test');
   await page.locator('#business-edit-description').fill('Independent coffee shop');await page.locator('#business-accuracy').check();
   await page.locator('#business-save').click();await page.locator('#business-feedback').filter({hasText:'Business details saved.'}).waitFor();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.name,'North & Field Updated');
   await page.reload();await page.locator('#business-name').filter({hasText:'North & Field Updated'}).waitFor();
   assert.equal(await page.locator('#business-edit-email').inputValue(),'seller@example.test');assert.equal(await page.locator('#business-edit-website').inputValue(),'https://example.test');
   await page.locator('#business-edit-name').fill('North & Field');await page.locator('#business-accuracy').check();await page.locator('#business-save').click();await page.locator('#business-feedback').filter({hasText:'Business details saved.'}).waitFor();
   console.log('Browser gate: live catalogue CRUD '+viewport.width+'px');
   if(viewport.width===375){
    await page.goto(base+'/selling-vendor/product-catalogue?businessId=vendor-a');await page.locator('#product-save-draft').click();await page.locator('#product-feedback').filter({hasText:'Saved and verified.'}).waitFor();
    let draft=(await repository.getKnownBusiness('vendor-a')).businessProfile.products[0];assert.equal(draft.name,'');assert.equal(draft.submission.state,'draft');assert.equal(draft.customerVisible,false);
    await page.reload();await page.locator('[data-product-state="'+draft.productId+'"]').filter({hasText:'Draft'}).waitFor();
    page.once('dialog',dialog=>dialog.accept());await page.locator('.catalogue-item > button').filter({hasText:'Delete',exact:true}).click();await page.locator('#product-feedback').filter({hasText:'Product deleted.'}).waitFor();
   }
   // Exercise real product persistence through the shipped form and isolated SQL.
   await page.goto(base+'/selling-vendor/product-catalogue?businessId=vendor-a');
   await page.locator('#product-form:visible').waitFor();
   if(viewport.width===375){
    const category=require('../api/_lib/marketing-agent-categories').getCategory('1');
    await page.locator('#product-name').fill(category.categoryName);
    await page.locator('#product-description').fill('Controlled product analysis');
    await page.locator('#intelligence-run').click();
    await page.locator('#intelligence-status').filter({hasText:'Analysis complete. Review the findings.'}).waitFor();
    assert.ok(await page.locator('[data-intelligence-rule="main-image"]').count(),'Real saved media are required');
    await page.locator('#intelligence-results button').filter({hasText:'Use suggested category: 1 ·'}).click();
    assert.equal(await page.locator('#product-category').inputValue(),'1','Category choice updates only the editor');
    assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,0,'Analysis never saves or publishes');
    assert.equal(await page.locator('#intelligence-results button').count(),0,'Editing invalidates displayed findings');
    await page.locator('#product-category').selectOption('');
   }
   await page.locator('#product-name').fill('Gate Coffee');
   await page.locator('#product-description').fill('Freshly roasted beans');
   await page.locator('#product-price-mode').selectOption('fixed');
   await page.locator('#product-price').fill('5');
   await page.locator('#product-availability').selectOption('available');
   if(viewport.width===375){
    const failSave=async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary persistence failure'})});else await route.continue();};
    await page.route('**/api/businesses?resource=selling-dashboard*',failSave);
    await page.locator('#product-save').click();await page.locator('#product-feedback').filter({hasText:'The service could not complete this action. Please retry.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,0,'Failed write has no false persisted product');
    await page.unroute('**/api/businesses?resource=selling-dashboard*',failSave);
   }
   await page.locator('#product-save').click();
   await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,1,'Product is persisted in SQL');
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].availability,'available','Product availability persisted in SQL');
   await page.reload();
   await page.locator('.catalogue-item h3').filter({hasText:'Gate Coffee'}).waitFor();
   await page.locator('#record-search').fill('NO MATCHING PRODUCT');await page.waitForFunction(()=>document.getElementById('record-count').textContent==='0 of 1 saved records');assert.equal(await page.locator('#catalogue-list .catalogue-item:visible').count(),0);
   assert.equal(await page.locator('#record-count').innerText(),'0 of 1 saved records');
   await page.locator('#record-search').fill('coffee');await page.waitForFunction(()=>document.getElementById('record-count').textContent==='1 of 1 saved records');assert.equal(await page.locator('#catalogue-list .catalogue-item:visible').count(),1);
   await page.locator('#record-search').fill('');await page.waitForResponse(r=>r.url().includes('view=catalogue')&&new URL(r.url()).searchParams.get('q')===''&&r.status()===200);
   await page.locator('.catalogue-item button').filter({hasText:'Edit'}).click();
   if(viewport.width===375){
    await page.locator('#intelligence-run').click();await page.locator('#intelligence-status').filter({hasText:'Analysis complete. Review the findings.'}).waitFor();
    await page.locator('#intelligence-results button').filter({hasText:'Mark findings reviewed'}).click();
    await page.locator('#intelligence-results button:disabled').filter({hasText:'Findings reviewed'}).waitFor();
    await page.reload();await page.locator('.catalogue-item button').filter({hasText:'Edit',exact:true}).click();
    await page.locator('#intelligence-run').click();await page.locator('#intelligence-status').filter({hasText:'Current saved analysis reused.'}).waitFor();
    assert.equal(await page.locator('#intelligence-results button:disabled').filter({hasText:'Findings reviewed'}).count(),1,'Review persists across refresh');
   }
   await page.locator('#product-name').fill('Gate Coffee Updated');
   assert.equal(await page.locator('#product-availability').inputValue(),'available','Edit restores saved availability');
   await page.locator('#product-availability').selectOption('unavailable');
   await page.locator('#product-save').click();
   await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].name,'Gate Coffee Updated');
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].availability,'unavailable','Availability edit persisted in SQL');
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('.catalogue-item button').filter({hasText:'Delete'}).click();
   await page.locator('#product-feedback').filter({hasText:'Product deleted.'}).waitFor();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,0,'Product deletion persisted in SQL');
   await page.reload();assert.equal(await page.locator('.catalogue-item').count(),0,'Deletion survives reload');
   // Real stock adjustment and audit history, including persistence across reload.
   await page.goto(base+'/selling-vendor/product-catalogue?businessId=vendor-a');
   await page.locator('#product-form:visible').waitFor();
   await page.locator('#product-name').fill('Stock Gate Product');
   await page.locator('#product-description').fill('Stock audit fixture');
   await page.locator('#product-save').click();
   await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();
   await page.goto(base+'/selling-vendor/options-variants?businessId=vendor-a');
   await page.locator('#variant-form:visible').waitFor();
   await page.locator('#variant-name').fill('Small / Black');
   await page.locator('#variant-sku').fill('COFFEE-S');
   await page.locator('#variant-price').fill('4.50');
   await page.locator('#variant-availability').selectOption('available');
   await page.locator('#variant-save').click();
   await page.locator('#variant-feedback').filter({hasText:'Variant saved.'}).waitFor();
   let savedVariant=(await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].variants[0];
   const savedVariantId=savedVariant.variantId;
   assert.equal(savedVariant.name,'Small / Black');assert.equal(savedVariant.price,'4.50');
   await page.reload();await page.locator('.variant-item strong').filter({hasText:'Small / Black'}).waitFor();
   await page.locator('.variant-item button').filter({hasText:'Edit',exact:true}).click();
   await page.locator('#variant-name').fill('Medium / Black');await page.locator('#variant-price').fill('5.50');
   await page.locator('#variant-save').click();await page.locator('#variant-feedback').filter({hasText:'Variant saved.'}).waitFor();
   savedVariant=(await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].variants[0];
   assert.equal(savedVariant.variantId,savedVariantId);assert.equal(savedVariant.name,'Medium / Black');
   await page.reload();await page.locator('.variant-item strong').filter({hasText:'Medium / Black'}).waitFor();
   if([375,1440].includes(viewport.width))await page.screenshot({path:path.join(artifacts,'demeos-selling-variants-'+viewport.width+'.png'),fullPage:true});
   page.once('dialog',dialog=>dialog.accept());await page.locator('.variant-item button').filter({hasText:'Delete',exact:true}).click();
   await page.locator('#variant-feedback').filter({hasText:'Variant deleted.'}).waitFor();await page.reload();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].variants.length,0);
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,1,'Variant deletion preserves parent product');
   await page.goto(base+'/selling-vendor/overview?businessId=vendor-a');await page.locator('[data-metric=products]').filter({hasText:'1'}).waitFor();
   assert.equal(await page.locator('[data-metric=variants]').innerText(),'0');
   await page.goto(base+'/selling-vendor/images-videos?businessId=vendor-a');await page.locator('#media-form:visible').waitFor();
   const imageBytes=await require('sharp')({create:{width:24,height:18,channels:3,background:'#06172d'}}).png().toBuffer();
   await page.locator('#media-file').setInputFiles({name:'coffee.png',mimeType:'image/png',buffer:imageBytes});
   if(viewport.width===375){
    refuseUploads=true;
    await page.locator('#media-upload').click();await page.locator('#media-feedback').filter({hasText:'File transfer failed. Retry the upload.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].mediaGallery?.assetIds?.length||0,0,'Refused transfer never links or claims ready media');
    refuseUploads=false;
   }
   await page.locator('#media-upload').click();await page.locator('#media-feedback').filter({hasText:'File uploaded and linked to product.'}).waitFor();
   const linked=(await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].mediaGallery.assetIds[0];
   const storedImage=await repository.getBusinessMediaAsset('vendor-a',linked);assert.equal(storedImage.state,'ready');assert.match(storedImage.sourceHash,/^[a-f0-9]{64}$/);assert.match(storedImage.processedHash,/^[a-f0-9]{64}$/);assert.ok(storedImage.processedSizeBytes>0);
   await page.reload();await page.locator('#media-list img').waitFor();await page.waitForFunction(()=>document.querySelector('#media-list img')?.naturalWidth>0);
   assert.ok(await page.locator('#media-list .media-actions button').count()>0);
   assert.ok(await page.locator('#media-list .media-actions button').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)<=14&&n.getBoundingClientRect().height>=44)),'Media controls stay compact with accessible touch targets');
   if([375,1440].includes(viewport.width))await page.screenshot({path:path.join(artifacts,'demeos-selling-media-'+viewport.width+'.png'),fullPage:true});
   if(viewport.width===375){
    const copy=require('../js/selling-dashboard-copy');
    assert.equal(await page.locator('#dashboard-language option').count(),10);
    for(const locale of copy.languages){
     await page.locator('#dashboard-language').selectOption(locale.code);
     await page.locator('#media-list img').waitFor();
     assert.equal(await page.locator('#media-upload').innerText(),copy.translate(locale.code,'Upload image'));
     assert.equal(await page.locator('#media-list [data-main-asset]').count(),1,'Ready media stays usable in every locale');
     for(const [section,title] of Object.entries(sections)){
      await page.locator('nav [data-section="'+section+'"]').click();
      await page.locator('#private-workspace:visible').waitFor();
      assert.equal(await page.locator('#section-heading').innerText(),copy.translate(locale.code,title[0]));
      assert.equal(await page.locator('.selling-footer a[href="/privacy.html"]').innerText(),copy.translate(locale.code,'Privacy'));
      assert.equal(await page.locator('.selling-footer p').evaluate(node=>getComputedStyle(node).direction),'ltr','Official statement retains its reading order in RTL locales');
      assert.equal(await page.locator('footer').count(),1);
      assert.equal(await page.locator('a[href*="marketing"]').count(),0,'Selling navigation never enters Marketing');
     }
     await page.reload();await page.locator('#private-workspace:visible').waitFor();
     assert.equal(await page.locator('#dashboard-language').inputValue(),locale.code);
     assert.ok((await page.evaluate(()=>window.loadedAuthLocale)).startsWith(locale.code),'Existing Clerk receives the selected authentication locale on reload');
     assert.equal(await page.locator('html').getAttribute('dir'),locale.direction);
     await page.locator('nav [data-section="images-videos"]').click();await page.locator('#media-list img').waitFor();
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Translated interface stays within the viewport');
     await page.screenshot({path:path.join(artifacts,'demeos-selling-language-'+locale.code+'.png'),fullPage:true});
     console.log('Selling locale navigation, ready image and refresh passed: '+locale.code);
    }
    await page.locator('#dashboard-language').selectOption('en');
   }

   if([375,1440].includes(viewport.width))await submissionJourney('vendor-a');
   page.once('dialog',dialog=>dialog.accept());await page.locator('#media-list button').filter({hasText:'Remove',exact:true}).click();
   await page.locator('#media-feedback').filter({hasText:'Media removed from product.'}).waitFor();await page.reload();
   assert.equal((await repository.getBusinessMediaAsset('vendor-a',linked)).state,'archived');assert.equal(await page.locator('#media-list img').count(),0);
   await page.goto(base+'/selling-vendor/stock-history?businessId=vendor-a');
   await page.locator('#stock-form:visible').waitFor();
   const stockProductId=(await repository.getKnownBusiness('vendor-a')).businessProfile.products[0].productId;
   const stockHistoryBefore=(await repository.getVendorInventory('vendor-a')).history.length;
   await page.locator('#stock-quantity').fill('12');
   await page.locator('#stock-note').fill('Initial stock count');
   await page.locator('#stock-save').click();
   await page.locator('#stock-feedback').filter({hasText:'Stock adjustment saved.'}).waitFor();
   let stockProduct=await repository.getVendorInventory('vendor-a');
   assert.equal(stockProduct.entries[JSON.stringify([stockProductId,''])].onHand,12,'Stock quantity persisted in SQL');
   assert.equal(stockProduct.history.length,stockHistoryBefore+1,'Stock adjustment audit record persisted');
   assert.equal(stockProduct.history[0].changes[0].reason,'Initial stock count');
   await page.reload();
   await page.locator('#stock-list').filter({hasText:'Quantity: 12'}).waitFor();
   await page.locator('#stock-quantity').fill('9');
   await page.locator('#stock-note').fill('Damaged units');
   await page.locator('#stock-save').click();
   await page.locator('#stock-feedback').filter({hasText:'Stock adjustment saved.'}).waitFor();
   stockProduct=await repository.getVendorInventory('vendor-a');
   assert.equal(stockProduct.entries[JSON.stringify([stockProductId,''])].onHand,9,'Second stock adjustment persisted');
   assert.equal(stockProduct.history.length,stockHistoryBefore+2,'Stock audit trail retained');
   assert.equal(stockProduct.history[0].changes[0].before,12,'Stock audit records previous quantity');
   assert.equal(stockProduct.history[0].changes[0].after,9,'Stock audit records new quantity');
   if([375,1440].includes(viewport.width))await page.screenshot({path:path.join(artifacts,'demeos-selling-stock-'+viewport.width+'.png'),fullPage:true});
   await page.goto(base+'/selling-vendor/product-catalogue?businessId=vendor-a');
   await page.locator('.catalogue-item button').filter({hasText:'Delete'}).waitFor();
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('.catalogue-item button').filter({hasText:'Delete'}).click();
   await page.locator('#product-feedback').filter({hasText:'Product deleted.'}).waitFor();
   assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,0,'Stock fixture removed');
   await page.goBack();await page.locator('#private-workspace:not([hidden])').waitFor();
   await page.goto(base+'/selling-vendor/my-business?businessId=vendor-a');await page.locator('#business-facts:not([hidden])').waitFor();
   assert.match(await page.locator('#business-facts').innerText(),/vendor-a/);
   await verifyDemeosIdentity();
   await verifyBusinessLayout(page,viewport);
   await page.screenshot({path:path.join(artifacts,'demeos-selling-business-'+viewport.width+'.png'),fullPage:true});
   await page.locator('#business-select').selectOption('vendor-a-second');await page.locator('#business-name').filter({hasText:'Business vendor-a-second'}).waitFor();
   assert.doesNotMatch(await page.locator('#business-facts').innerText(),/North & Field/);
   await page.goto(base+'/selling-vendor/private-orders?businessId=vendor-b');await page.locator('#dashboard-status[data-state=denied]').waitFor();
   assert.equal(await page.locator('#private-workspace').isVisible(),false);assert.equal(await page.locator('#business-name').innerText(),'');
   await page.locator('#choose-business').click();await page.locator('#private-workspace:not([hidden])').waitFor();
   delay=400;await page.locator('nav [data-section=overview]').click();await page.locator('#dashboard-status[data-state=loading]').waitFor();assert.equal(await page.locator('#private-workspace').isVisible(),false);
   await page.locator('#private-workspace:not([hidden])').waitFor();delay=0;
   failure=true;await page.locator('nav [data-section=my-business]').click();await page.locator('#dashboard-status[data-state=error]').waitFor();failure=false;
   await page.locator('#retry').click();await page.locator('#private-workspace:not([hidden])').waitFor();
   // A 401 must retry with a fresh Clerk token using the same context API.
   await page.evaluate(()=>{window.tokenAttempts=[];window.Clerk.session.getToken=async options=>{window.tokenAttempts.push(options.skipCache);return 'verified-token';};});
   let refused=false;
   const expire=async route=>{if(!refused){refused=true;await route.fulfill({status:401,contentType:'application/json',body:'{}'});}else await route.continue();};
   await page.route('**/api/businesses?resource=selling-dashboard*',expire);
   await page.locator('nav [data-section=overview]').click();await page.locator('#private-workspace:not([hidden])').waitFor();
   assert.deepEqual(await page.evaluate(()=>window.tokenAttempts),[false,true]);await page.unroute('**/api/businesses?resource=selling-dashboard*',expire);
   await context.addCookies([{name:'gate-owner',value:'owner-empty',url:base}]);await page.reload();await page.locator('#dashboard-status[data-state=empty]').waitFor();
   await context.addCookies([{name:'gate-owner',value:'owner-a',url:base}]);
   console.log('Browser gate: Preview authorization '+viewport.width+'px');
   env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgresql://owner:fixture@isolated.example/neondb',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-business-selling-a","ownerIdentityId":"owner-a"}]'};
   await page.goto(base+'/selling-vendor');await page.locator('#environment-label[data-environment=test]').waitFor();
   assert.equal(await page.locator('#business-select option').count(),1);assert.equal(await page.locator('#business-name').innerText(),'DEMEOS Test Vendor');
   // Preview writes use the real dashboard and the explicitly isolated test business.
   if(viewport.width===375){
    await page.goto(base+'/selling-vendor/my-business');await page.locator('#business-form:visible').waitFor();
    await verifyLogo(page,repository,'test-business-selling-a');
    await page.locator('#business-edit-email').fill('seller@example.test');await page.locator('#business-edit-phone').fill('+44 20 7946 0123');await page.locator('#business-edit-website').fill('https://example.test');
   await page.locator('#business-edit-description').fill('Isolated test business facts');await page.locator('#business-accuracy').check();await page.locator('#business-save').click();await page.locator('#business-feedback').filter({hasText:'Business details saved.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.productsServices,'Isolated test business facts');assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.applicationAccess,undefined);
    await page.locator('nav [data-section=product-catalogue]').click();
    await page.locator('#product-form:visible').waitFor();
    await page.locator('#product-name').fill('Preview Coffee');
    await page.locator('#product-description').fill('Test-only catalogue entry');
    await page.locator('#product-price-mode').selectOption('fixed');
    await page.locator('#product-price').fill('7');
    await page.locator('#product-save').click();
    await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.products[0].name,'Preview Coffee','Preview product persisted in isolated test business');
    assert.equal((await repository.getKnownBusiness('vendor-a')).businessProfile.products.length,0,'Preview did not write to live vendor');
    await page.reload();
    await page.locator('.catalogue-item h3').filter({hasText:'Preview Coffee'}).waitFor();
    await page.goto(base+'/selling-vendor/options-variants');await page.locator('#variant-form:visible').waitFor();
    await page.locator('#variant-name').fill('Preview Large');await page.locator('#variant-sku').fill('PRE-L');
    await page.locator('#variant-save').click();await page.locator('#variant-feedback').filter({hasText:'Variant saved.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.products[0].variants[0].name,'Preview Large');
    await page.reload();await page.locator('.variant-item strong').filter({hasText:'Preview Large'}).waitFor();
    await page.locator('.variant-item button').filter({hasText:'Edit',exact:true}).click();await page.locator('#variant-name').fill('Preview Medium');
    await page.locator('#variant-save').click();await page.locator('#variant-feedback').filter({hasText:'Variant saved.'}).waitFor();
    await page.reload();await page.locator('.variant-item strong').filter({hasText:'Preview Medium'}).waitFor();
    page.once('dialog',dialog=>dialog.accept());await page.locator('.variant-item button').filter({hasText:'Delete',exact:true}).click();
    await page.locator('#variant-feedback').filter({hasText:'Variant deleted.'}).waitFor();await page.reload();
    assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.products[0].variants.length,0);
    await page.goto(base+'/selling-vendor/images-videos');await page.locator('#media-form:visible').waitFor();
    await page.locator('#media-file').setInputFiles({name:'preview.png',mimeType:'image/png',buffer:await require('sharp')({create:{width:20,height:16,channels:3,background:'#c99a2e'}}).png().toBuffer()});
    await page.locator('#media-upload').click();await page.locator('#media-feedback').filter({hasText:'File uploaded and linked to product.'}).waitFor();
    const previewMediaId=(await repository.getKnownBusiness('test-business-selling-a')).businessProfile.products[0].mediaGallery.assetIds[0];
    await page.reload();await page.waitForFunction(()=>document.querySelector('#media-list img')?.naturalWidth>0);
    await submissionJourney('test-business-selling-a');
   page.once('dialog',dialog=>dialog.accept());await page.locator('#media-list button').filter({hasText:'Remove',exact:true}).click();
    await page.locator('#media-feedback').filter({hasText:'Media removed from product.'}).waitFor();
    assert.equal((await repository.getBusinessMediaAsset('test-business-selling-a',previewMediaId)).state,'archived');
    await page.goto(base+'/selling-vendor/stock-history');await page.locator('#stock-form:visible').waitFor();
    await page.locator('#stock-quantity').fill('7');await page.locator('#stock-note').fill('Preview count');
    await page.locator('#stock-save').click();await page.locator('#stock-feedback').filter({hasText:'Stock adjustment saved.'}).waitFor();
    assert.equal(Object.values((await repository.getVendorInventory('test-business-selling-a')).entries)[0].onHand,7);
    await page.reload();await page.locator('#stock-list').filter({hasText:'Quantity: 7'}).waitFor();
    assert.equal((await repository.getVendorInventory('test-business-selling-a')).history[0].changes[0].reason,'Preview count');
    await page.goto(base+'/selling-vendor/product-catalogue');await page.locator('.catalogue-item').waitFor();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('.catalogue-item button').filter({hasText:'Delete'}).click();
    await page.locator('#product-feedback').filter({hasText:'Product deleted.'}).waitFor();
    assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.products.length,0,'Preview deletion persisted');
   }
   for(const [section,copy] of Object.entries(sections)){
    const heading=['product-catalogue','stock-history'].includes(section)?(section==='stock-history'?'Stock & History':'Product Catalogue'):copy[1];
    await page.locator('nav [data-section="'+section+'"]').click();await page.locator('#content-heading').filter({hasText:heading}).waitFor();
    await page.reload();await page.locator('#content-heading').filter({hasText:heading}).waitFor();
    assert.equal(await page.locator('nav [data-section]').count(),7);
    assert.doesNotMatch(await page.locator('main').innerText(),/Application access pending/);
    assert.ok(page.url().includes('/selling-vendor'));
   }
   await page.locator('nav [data-section=overview]').click();await page.locator('#content-heading').filter({hasText:sections.overview[1]}).waitFor();
   await verifyDemeosIdentity();
   await verifyBusinessLayout(page,viewport);
   await page.screenshot({path:path.join(artifacts,'demeos-selling-test-'+viewport.width+'.png'),fullPage:true});
   const grants=env.DEMEOS_SELLING_TEST_AUTHORIZATIONS;env.DEMEOS_SELLING_TEST_AUTHORIZATIONS='[]';await page.reload();await page.locator('#dashboard-status[data-state=empty]').waitFor();env.DEMEOS_SELLING_TEST_AUTHORIZATIONS=grants;
   env={VERCEL_ENV:'production'};
   await page.goto(base+'/selling-vendor?businessId=test-business-selling-a');await page.locator('#dashboard-status[data-state=denied]').waitFor();
   await page.goto(base+'/selling-vendor?businessId=vendor-a');await page.locator('#private-workspace:not([hidden])').waitFor();
   await page.locator('#sign-out').click();await page.locator('#dashboard-status[data-state=signed-out]').waitFor();assert.equal(await page.locator('#private-workspace').isVisible(),false);
   await page.locator('#sign-in').click();assert.equal(await page.evaluate(()=>window.signInRequest.forceRedirectUrl),'/selling-vendor');
   assert.equal(await page.evaluate(()=>window.signInRequest.fallbackRedirectUrl),'/selling-vendor');
   await page.evaluate(()=>{window.Clerk.user={id:'owner-b'};window.Clerk.session={id:'session-b',async getToken(){return 'verified-token';}};});
   await context.addCookies([{name:'gate-owner',value:'owner-b',url:base}]);await page.evaluate(()=>window.Clerk.listener());await page.locator('#dashboard-status[data-state=denied]').waitFor();
   assert.equal(await page.locator('#business-name').innerText(),'');
   await context.clearCookies();assert.equal((await context.request.get(base+'/api/businesses?resource=selling-dashboard')).status(),401);
   await context.addCookies([{name:'gate-owner',value:'owner-b',url:base}]);
   await page.goto(base+'/selling-vendor/private-orders?businessId=vendor-b');
   await page.locator('#orders-list summary').filter({hasText:genuineOrder.id}).waitFor();
   await page.locator('#orders-list summary').click();assert.match(await page.locator('#orders-list').innerText(),/Reserved Shirt/);
   assert.match(await page.locator('#orders-list').innerText(),/4300|4000/);
   assert.equal(await page.locator('#orders-list button').count(),0,'No unsupported vendor order transition');
   await page.reload();await page.locator('#orders-list summary').filter({hasText:genuineOrder.id}).waitFor();
   await page.screenshot({path:path.join(artifacts,'demeos-selling-orders-'+viewport.width+'.png'),fullPage:true});
   await page.goto(base+'/selling-vendor/product-catalogue?businessId=vendor-b');await page.locator('[data-product-state=order-shirt]').filter({hasText:'Not submitted'}).waitFor();assert.equal((await repository.getKnownBusiness('vendor-b')).businessProfile.products[0].submission,undefined,'Reading a legacy product cannot invent a submission or change its visibility');
   await page.goto(base+'/selling-vendor/options-variants?businessId=vendor-b');await page.locator('.variant-item button').filter({hasText:'Edit',exact:true}).click();
   await page.locator('#variant-name').fill('Medium / Navy');await page.locator('#variant-price').fill('21.50');await page.locator('#variant-save').click();await page.locator('#variant-feedback').filter({hasText:'Variant saved.'}).waitFor();
   const structuredVariant=(await repository.getKnownBusiness('vendor-b')).businessProfile.products[0].presentation.variants[0];
   assert.deepEqual(structuredVariant.selection,{size:'M'});assert.equal(structuredVariant.pricing.amount,21.5);
   await page.reload();await page.locator('.variant-item strong').filter({hasText:'Medium / Navy'}).waitFor();
   page.once('dialog',dialog=>dialog.accept());await page.locator('.variant-item button').filter({hasText:'Delete',exact:true}).click();await page.locator('#variant-feedback').filter({hasText:'Reserved stock prevents this change.'}).waitFor();
   await page.goto(base+'/selling-vendor/stock-history?businessId=vendor-b');await page.locator('#stock-form:visible').waitFor();
   const heldStock=(await repository.getVendorInventory('vendor-b')).entries[orderInventory.key('order-shirt','medium')];
   const nextQuantity=heldStock.onHand===5?4:5;
   await page.locator('#stock-quantity').fill(String(nextQuantity));await page.locator('#stock-note').fill('Count with reservation retained');await page.locator('#stock-save').click();await page.locator('#stock-feedback').filter({hasText:'Stock adjustment saved.'}).waitFor();
   assert.equal((await repository.getVendorInventory('vendor-b')).entries[orderInventory.key('order-shirt','medium')].reserved,2);
   await page.reload();await page.locator('#stock-list').filter({hasText:'Quantity: '+nextQuantity}).waitFor();
   assert.doesNotMatch(await page.locator('#stock-list').innerText(),/undefined|NaN/,'Reservation audit entries render real quantities');

   if(viewport.width===375){
    const businessId='vendor-a-second',original=(await repository.getKnownBusiness(businessId)).businessProfile;
    const products=Array.from({length:62},(_,i)=>({businessId,productId:'catalogue-'+String(i).padStart(3,'0'),name:'Catalogue '+String(i).padStart(3,'0'),sku:'CODE-'+i,description:'Controlled catalogue workflow record',price:'10',priceMode:'fixed',availability:'contact',classification:{categoryId:'1',sectorId:'1',datasetVersion:'marketing-agent-categories-v1'}}));
    await repository.saveBusiness({...original,products});await context.addCookies([{name:'gate-owner',value:'owner-a',url:base}]);
    await page.goto(base+'/selling-vendor/product-catalogue?businessId='+businessId);await page.locator('#record-count').filter({hasText:'25 of 62 saved records'}).waitFor();
    assert.equal(await page.locator('#catalogue-list article').count(),25);await page.locator('#catalogue-next').click();await page.locator('#catalogue-page-status').filter({hasText:'Page 2'}).waitFor();assert.equal(await page.locator('#catalogue-list article').count(),25);
    await page.locator('#catalogue-previous').click();await page.locator('#catalogue-page-status').filter({hasText:'Page 1'}).waitFor();
    await page.locator('#catalogue-category').selectOption('10');await page.locator('#record-count').filter({hasText:'0 of 62 saved records'}).waitFor();
    await page.locator('#catalogue-category').selectOption('');await page.locator('#record-count').filter({hasText:'25 of 62 saved records'}).waitFor();
    await page.locator('#record-search').fill('CODE-61');await page.locator('#record-count').filter({hasText:'1 of 62 saved records'}).waitFor();assert.equal(await page.locator('#catalogue-list h3').innerText(),'Catalogue 061');
    await page.locator('[data-select-product]').check();await page.locator('#catalogue-bulk-availability').selectOption('unavailable');page.once('dialog',d=>d.accept());await page.locator('#catalogue-apply').click();await page.locator('#product-feedback').filter({hasText:'Availability updated.'}).waitFor();assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.products.find(p=>p.productId==='catalogue-061').availability,'unavailable');
    await page.locator('#record-search').fill('');await page.locator('#record-count').filter({hasText:'25 of 62 saved records'}).waitFor();
    await page.locator('#product-name').fill('New device draft');await page.locator('#product-description').fill('A device with specified model');await page.locator('#product-sku').fill('DEVICE-NEW');await page.locator('#product-category').selectOption('11');await page.locator('[data-category-field=model]').fill('MODEL-1');await page.locator('[data-category-field=specifications]').fill('24 MP');
    page.once('dialog',d=>d.accept());await page.reload();await page.locator('#product-feedback').filter({hasText:'Unsaved product recovered.'}).waitFor();assert.equal(await page.locator('#product-name').inputValue(),'New device draft');assert.equal(await page.locator('[data-category-field=model]').inputValue(),'MODEL-1');
    await page.locator('#dashboard-language').selectOption('ar');assert.equal(await page.locator('[data-category-field=specifications]').inputValue(),'24 MP');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');await page.locator('#dashboard-language').selectOption('en');
    const profileEdit=(await repository.getKnownBusiness(businessId)).businessProfile;await repository.saveBusiness({...profileEdit,location:'New saved location'});
    await page.locator('#product-save').click();await page.locator('#product-feedback').filter({hasText:'Product saved.'}).waitFor();let current=(await repository.getKnownBusiness(businessId)).businessProfile;assert.equal(current.location,'New saved location');const device=current.products.find(p=>p.sku==='DEVICE-NEW');assert.equal(device.categoryAttributes.byCategory['11'].model,'MODEL-1');
    await page.locator('#record-search').fill('DEVICE-NEW');await page.locator('#record-count').filter({hasText:'1 of 63 saved records'}).waitFor();await page.locator('#catalogue-list > article > button').filter({hasText:'Edit',exact:true}).click();await page.locator('#product-name').fill('Stale edit');
    current=(await repository.getKnownBusiness(businessId)).businessProfile;await repository.saveBusiness({...current,products:current.products.map(p=>p.productId===device.productId?{...p,name:'Newer session edit'}:p)});
    await page.locator('#product-save').click();await page.locator('#product-feedback').filter({hasText:'Information changed. Reload and review.'}).waitFor();assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.products.find(p=>p.productId===device.productId).name,'Newer session edit');
    page.once('dialog',d=>d.accept());await page.locator('#product-cancel').click();await repository.saveBusiness(original);
    console.log('Catalogue SQL pagination, filters, bulk changes, category fields, recovered drafts, Arabic and stale edits passed');
   }

   if([375,1440].includes(viewport.width)){
    env={VERCEL_ENV:'production'};await context.addCookies([{name:'gate-owner',value:'owner-a',url:base}]);
    const businessId='vendor-a-second',previous=(await repository.getKnownBusiness(businessId)).businessProfile;
    const productId='frame-product-'+viewport.width,assetId='frame-ui-'+viewport.width,storageKey='businesses/'+businessId+'/media/'+assetId+'/processed/master.mp4';
    const tmp=await require('node:fs/promises').mkdtemp('/tmp/demeos-frame-ui-'),file=path.join(tmp,'source.mp4');
    await require('node:util').promisify(require('node:child_process').execFile)(require('ffmpeg-static'),['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',file],{timeout:10000});
    const bytes=await require('node:fs/promises').readFile(file);await require('node:fs/promises').rm(tmp,{recursive:true,force:true});
    await disk.fetchImpl('https://storage.gate/'+encodeURIComponent(storageKey),{method:'PUT',headers:{'Content-Type':'video/mp4','x-content-type':'video/mp4','x-vercel-blob-access':'private'},body:bytes});
    await repository.saveBusiness({...previous,products:[{businessId,productId,name:'Real video frames',description:'Controlled actual MP4',priceMode:'contact',availability:'contact',mediaGallery:{assetIds:[assetId],mainAssetId:''}}]});
    await repository.saveBusinessMediaAsset(businessId,{businessId,assetId,relatedEntityId:productId,purpose:'product',kind:'video',state:'ready',width:320,height:180,durationSeconds:2,contentType:'video/mp4',sizeBytes:bytes.length,storageKey:'businesses/'+businessId+'/media/'+assetId+'/original',processedStorageKey:storageKey,deliveryUrl:'https://storage.gate/'+encodeURIComponent(storageKey)});
    disk.drivers.extractVideoFrames=require('../api/_lib/media-ffmpeg-driver').createFfmpegVideoDrivers({fetchImpl:disk.fetchImpl}).extractVideoFrames;
    await page.goto(base+'/selling-vendor/images-videos?businessId='+businessId);await page.getByRole('button',{name:'Extract video frames',exact:true}).click();await page.getByRole('button',{name:'Video frames ready',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('.video-frame-gallery img').length===4&&[...document.querySelectorAll('.video-frame-gallery img')].every(i=>i.naturalWidth>0));
    assert.equal(await page.locator('video').evaluate(v=>Boolean(v.poster)),true);await page.reload();await page.getByRole('button',{name:'Video frames ready',exact:true}).waitFor();
    const copy=require('../js/selling-dashboard-copy');for(const locale of copy.languages){await page.locator('#dashboard-language').selectOption(locale.code);await page.getByRole('button',{name:copy.translate(locale.code,'Video frames ready'),exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('dir'),locale.code==='ar'?'rtl':'ltr');}
    await page.locator('#dashboard-language').selectOption('en');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(artifacts,'demeos-selling-real-frames-'+viewport.width+'.png'),fullPage:true});
    const record=await repository.getBusinessMediaAsset(businessId,assetId);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove',exact:true}).click();await page.locator('#media-feedback').filter({hasText:'Media removed from product.'}).waitFor();
    for(const f of record.videoFrames.frames)assert.equal(await disk.driver.verifyUpload({storageKey:f.storageKey}),null);await repository.saveBusiness(previous);delete disk.drivers.extractVideoFrames;
    console.log('Actual FFmpeg frame extraction, private posters, refresh, ten languages and cleanup passed at '+viewport.width+'px');
   }

   // WebKit reports some cancelled navigation fetches as synthetic pageerror
   // events. Exempt only the same-origin auth-copy read with a matching, explicitly
   // cancelled network request; real CORS failures and JS exceptions still fail.
   const unexpected=errors.filter(error=>!(engine===webkit&&error.name==='Fetch API cannot load http'&&error.message.includes('/js/customer-auth-locales/')&&failedRequests.some(request=>request.url.startsWith(base+'/js/customer-auth-locales/')&&error.message.includes(request.url.replace('http:/',''))&&/cancelled|canceled|abort/i.test(request.error))));
   assert.deepEqual(unexpected,[]);await context.close();
   console.log('Selling dashboard SQL + rendered gate passed at '+viewport.width+'px');
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));await new Promise(r=>uploadServer.close(r));await client.close();await require('node:fs/promises').rm(disk.root,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
