'use strict';
// Actual owner APIs/repository/SQL with an isolated identity-provider adapter.
// No production account, business, publication or external provider is used.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>{const id=req.headers.cookie?.match(/engineering-owner=(owner-[a-z0-9-]+)/)?.[1];return id?{trustedIdentityId:id}:null;};
// Controlled storage adapter exercises the real registration/completion endpoints.
// Upload bytes use a local test transport; no cloud storage or credentials are used.
process.env.DEMEOS_MEDIA_UPLOAD_SECRET='isolated-browser-upload-secret-32-bytes';
const uploads=new Map();
require('../api/_lib/media-storage-driver').getConfiguredMediaStorageAdapter=()=>({
 async createUpload(asset){const storageKey='businesses/'+asset.businessId+'/media/'+asset.assetId+'/original';uploads.set(asset.assetId,{asset,storageKey,uploaded:false});return {storageKey,uploadUrl:'https://controlled-upload.example/'+asset.assetId};},
 async verifyUpload(asset,key){const stored=uploads.get(asset.assetId);return stored?.uploaded&&stored.storageKey===key?{storageKey:key}:null;}
});
const completeMedia=require('../api/businesses/[businessId]/media/[assetId]');
const list=require('../api/businesses'),business=require('../api/businesses/[businessId]'),campaign=require('../api/businesses/[businessId]/campaigns/[campaignId]'),media=require('../api/businesses/[businessId]/media/index'),publicWork=require('../api/customer/work');
const checkout=require('../api/_lib/customer-checkout').createHandler({authenticate:async req=>{const identity=await auth.resolveTrustedIdentityFromRequest(req);return identity?{trustedCustomerIdentityId:identity.trustedIdentityId}:null;},repository:()=>repository});
const generatorModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/generate.js'),'utf8').replace('export default async function handler','module.exports = async function handler'),{module:generatorModule,require:createRequire(path.join(root,'api/generate.js')),console,process:{env:{}},fetch(){throw Error('No external provider may be called');}});
const asset={businessId:'engineering-a',assetId:'engineering-image',relatedEntityId:'offer-a',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
const profile={businessId:'engineering-a',name:'Engineering Owner A',type:'Fashion',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share saved products',profileVersion:4,preparationModel:'selling',offeringCategoryId:'fashion.apparel',productsServices:'Owner products',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'engineering-a',productId:'offer-a',name:'Exact jacket',description:'Saved jacket description',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:true,fulfilment:{methods:['collection']},presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'exact-medium',selection:{size:'M'},availability:'limited',pricing:{mode:'fixed',currency:'GBP',amount:91},future:'retained'}],future:'retained'}}]};
const inventory=require('../api/businesses/[businessId]/inventory'),products=require('../api/businesses/[businessId]/products'),ordersHandler=require('../api/businesses/[businessId]/orders');
const orderFoundation=require('../api/_lib/vendor-orders').createVendorOrders(database,{authorizePurchase:()=>true}); // isolated test authority only
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);res.end();return;}}req.body=raw?JSON.parse(raw):{};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 if(url.pathname==='/api/businesses')return await list(req,res);
 const vendorRoute=url.pathname.match(/^\/api\/businesses\/([^/]+)\/(inventory|products|orders)$/);if(vendorRoute){req.query.businessId=vendorRoute[1];return await (vendorRoute[2]==='inventory'?inventory:vendorRoute[2]==='orders'?ordersHandler:products)(req,res);}
 let match=url.pathname.match(/^\/api\/businesses\/([^/]+)(?:\/campaigns\/([^/]+))?$/);
 if(match){req.query.businessId=decodeURIComponent(match[1]);if(match[2]){req.query.campaignId=decodeURIComponent(match[2]);return await campaign(req,res);}return await business(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)\/media\/([^/]+)$/);if(match){req.query.businessId=match[1];req.query.assetId=match[2];return await completeMedia(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)\/media$/);if(match){req.query.businessId=match[1];return await media(req,res);}
 if(url.pathname==='/api/customer/checkout')return await checkout(req,res);
 if(url.pathname==='/api/generate')return await generatorModule.exports(req,res);
 if(url.pathname==='/api/customer/work')return await publicWork(req,res);
 if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Not configured'});
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/business-workspace.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});
(async()=>{
 await database.ensureSchema();await repository.createBusinessForOwner('owner-a',profile);
 await repository.createBusinessForOwner('owner-b',{...profile,businessId:'engineering-b',products:[],name:'Other business'});
 await repository.saveBusinessMediaAsset(profile.businessId,asset);
 await repository.saveBusinessMediaAsset(profile.businessId,{...asset,assetId:'engineering-image-two'});
 await repository.saveBusinessMediaAsset(profile.businessId,{...asset,assetId:'private-marketing-image',relatedEntityId:undefined,purpose:'marketing'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.DEMEOS_BROWSER_CHANNEL?{channel:process.env.DEMEOS_BROWSER_CHANNEL}:{})});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport});await context.addCookies([{name:'engineering-owner',value:'owner-a',url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:"window.Clerk={user:{id:'owner-a'},session:null,async load(){},addListener(fn){this.listener=fn;},async signOut(){this.user=null;this.listener({user:null});}};"}));
   await context.route('https://example.org/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(root,'images/controlled-test/mens-fashion.webp'))}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',dialog=>dialog.accept());
   await page.goto(base+'/marketing.html#inventory');await page.locator('.vendor-stock-row').first().waitFor().catch(async e=>{console.log(await page.evaluate(()=>({model:document.body.dataset.ownerModel,view:document.body.dataset.ownerView,status:document.getElementById('vendor-stock-status').textContent,text:document.body.innerText.slice(-2500)})),errors);await page.screenshot({path:'/tmp/vendor-failed.png',fullPage:true});throw e;});
   await database.query('DELETE FROM demeos_vendor_order_requests');await database.query('DELETE FROM demeos_vendor_order_events');await database.query('DELETE FROM demeos_vendor_orders');
   await page.goto(base+'/marketing.html#orders');await page.locator('#vendor-orders-list').filter({hasText:'No orders yet. Live ordering is not active.'}).waitFor();
   const orderCopy=require('../js/vendor-inventory-copy').copy;
   for(const code of Object.keys(orderCopy)){await page.locator('#owner-preparation-language').selectOption(code);assert.equal(await page.locator('#vendor-orders-list').innerText(),orderCopy[code].ordersEmpty);assert.equal(await page.locator('#vendor-orders-heading').innerText(),orderCopy[code].orders);assert.equal(await page.locator('#vendor-orders-list').getAttribute('dir'),code==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.locator('#owner-preparation-language').selectOption('en');await page.screenshot({path:'/tmp/demeos-owner-vendor-orders-empty-'+viewport.width+'.png',fullPage:true});
   assert.equal((await context.request.get(base+'/api/businesses/engineering-b/orders')).status(),403);assert.equal((await context.request.post(base+'/api/businesses/engineering-a/orders',{data:{quantity:1}})).status(),405);
   await page.goto(base+'/marketing.html#inventory');await page.locator('.vendor-stock-row').first().waitFor();
   const count=String(10+viewport.width);await page.locator('.vendor-stock-row input[type=number]').first().fill(count);
   await page.locator('#vendor-stock-reason').fill('Isolated browser count');await page.locator('#vendor-stock-save').click();await page.locator('#vendor-stock-review button').first().click();
   await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent==='Stock saved.');
   await page.reload();await page.locator('.vendor-stock-row').first().waitFor();assert.equal(await page.locator('.vendor-stock-row input[type=number]').first().inputValue(),count);
   const savedOrderProfile=(await repository.getKnownBusiness(profile.businessId)).businessProfile,orderInventory=require('../api/_lib/vendor-inventory');
   const reservedOrder=await orderFoundation.reserve('isolated-customer','browser-order-'+viewport.width,{businessId:profile.businessId,productId:'offer-a',variantId:'exact-medium',selection:{size:'M'},quantity:1,catalogueRevision:orderInventory.catalogueRevision(savedOrderProfile),stockIdentity:orderInventory.stockIdentity(savedOrderProfile.products[0],savedOrderProfile.products[0].presentation.variants[0])});
   await page.goto(base+'/marketing.html#orders');await page.locator('.vendor-order-row').waitFor();assert.match(await page.locator('.vendor-order-row').innerText(),/Exact jacket/);assert.doesNotMatch(await page.locator('#vendor-orders-list').innerText(),/isolated-customer/);
   await page.screenshot({path:'/tmp/demeos-owner-vendor-orders-'+viewport.width+'.png',fullPage:true});
   await orderFoundation.release(reservedOrder.id,'cancelled','isolated-customer');
   const refreshedStock=page.waitForResponse(response=>response.url().endsWith('/inventory')&&response.request().method()==='GET');
   await page.goto(base+'/marketing.html#inventory');await refreshedStock;await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent==='');await page.locator('.vendor-stock-row').first().waitFor();
   await page.locator('.vendor-stock-row input[type=number]').first().fill(String(Number(count)+1));
   await page.locator('#vendor-stock-reason').fill('Failure recovery');
   await page.route('**/inventory',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Controlled save failure. Your edits are retained.'}}):route.continue());
   await page.locator('#vendor-stock-save').click();await page.locator('#vendor-stock-review button').first().click();
   await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent.includes('retained'));
   assert.equal(await page.locator('.vendor-stock-row input[type=number]').first().inputValue(),String(Number(count)+1));
   assert.equal((await repository.getVendorInventory(profile.businessId)).entries[JSON.stringify(['offer-a','exact-medium'])].onHand,Number(count));
   await page.unroute('**/inventory');await page.locator('#vendor-stock-review button').first().click();await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent==='Stock saved.');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
   await page.screenshot({path:'/tmp/demeos-owner-vendor-stock-'+viewport.width+'.png',fullPage:true});
   await page.locator('#vendor-stock-search').fill('nothing matches');assert.match(await page.locator('#vendor-stock-list').textContent(),/No matching/);await page.locator('#vendor-stock-search').fill('');
   await page.locator('#owner-preparation-language').selectOption('ja');assert.equal(await page.locator('#vendor-stock-heading').textContent(),'在庫');await page.locator('#owner-preparation-language').selectOption('en');
   await page.goto(base+'/marketing.html#products');await page.locator('#vendor-products-save:not([disabled])').waitFor();
   await page.locator('.business-product-card-actions button').filter({hasText:'Edit'}).first().click();assert.equal(await page.locator('#business-product-id').inputValue(),'offer-a');
   await page.locator('#vendor-product-editor > summary').click();await page.locator('#vendor-product-editor > summary').click();assert.equal(await page.locator('#business-product-id').inputValue(),'');
   assert.equal((await page.locator('#business-media-list').textContent()).includes('Business marketing media'),false);
   let failedOnce=false;const uploadedNames=[],completionCalls=new Map();let registrations=0;
   page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/media'))registrations++;});
   await page.route('**/media/*',async route=>{
    if(route.request().method()!=='PATCH')return route.continue();
    const id=new URL(route.request().url()).pathname.split('/').at(-1),attempt=(completionCalls.get(id)||0)+1;completionCalls.set(id,attempt);
    const response=await route.fetch();
    if(uploads.get(id)?.bytes==='completion-file'&&attempt===1)return route.fulfill({status:503,json:{error:'Controlled lost completion response'}});
    return route.fulfill({response});
   });
   await context.route('https://controlled-upload.example/**',async route=>{
    const id=new URL(route.request().url()).pathname.slice(1),stored=uploads.get(id);assert.equal(stored.asset.businessId,profile.businessId);assert.equal(stored.asset.relatedEntityId,'offer-a');
    const bytes=route.request().postDataBuffer();const text=bytes.toString();stored.bytes=text;uploadedNames.push(text);
    if(text==='retry-file'&&!failedOnce){failedOnce=true;return route.fulfill({status:500});}
    stored.uploaded=true;return route.fulfill({status:200});
   });
   await page.locator('#business-media-product').selectOption('offer-a');
   await page.locator('#business-media-file').setInputFiles([{name:'success.png',mimeType:'image/png',buffer:Buffer.from('success-file')},{name:'retry.png',mimeType:'image/png',buffer:Buffer.from('retry-file')},{name:'completion.png',mimeType:'image/png',buffer:Buffer.from('completion-file')}]);
   await page.locator('#business-media-upload-btn').click();await page.waitForFunction(()=>document.getElementById('business-media-upload-btn').disabled===false);
   assert.match(await page.locator('#business-media-status').textContent(),/retry.png/);
   assert.equal(await page.locator('#business-media-file').evaluate(input=>input.files.length),2);
   await page.locator('#business-media-product').selectOption(''); // Retries retain their original saved product.
   await page.locator('#business-media-upload-btn').click();await page.waitForFunction(()=>document.getElementById('business-media-upload-btn').disabled===false);
   assert.deepEqual(uploadedNames,['success-file','retry-file','completion-file','retry-file']);assert.equal(registrations,3);
   const completionAsset=[...uploads.values()].find(x=>x.bytes==='completion-file'&&completionCalls.has(x.asset.assetId));assert.equal(completionCalls.get(completionAsset.asset.assetId),2);
   await page.unroute('**/media/*');
   assert.equal(await page.locator('#business-media-file').evaluate(input=>input.files.length),0);
   const storedUploads=[...uploads.values()].filter(x=>x.uploaded&&completionCalls.has(x.asset.assetId));for(const stored of storedUploads){const savedAsset=await repository.getBusinessMediaAsset(profile.businessId,stored.asset.assetId);assert.equal(savedAsset.state,'processing');}
   // Advance fresh uploads through the real SQL queue/lifecycle using an isolated processor result.
   const {processNextMediaJob}=require('../api/_lib/media-processing-queue');
   for(let job;job=await processNextMediaJob(repository,async asset=>({success:true,storageKey:'businesses/'+asset.businessId+'/media/'+asset.assetId+'/processed/master.webp',deliveryUrl:'https://example.org/'+asset.assetId+'.webp',width:1200,height:800}));)assert.equal(job.status,'completed');
   await page.reload();await page.locator('#vendor-products-save:not([disabled])').waitFor();
   const freshCard=id=>page.locator('.business-media-item').filter({has:page.locator('img[src="https://example.org/'+id+'.webp"]')});
   await freshCard(storedUploads[0].asset.assetId).getByRole('button',{name:'Add to gallery',exact:true}).click();await freshCard(storedUploads[0].asset.assetId).getByRole('button',{name:'Set as main image',exact:true}).click();
   await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');
   const saved=await repository.getKnownBusiness(profile.businessId);assert.equal(saved.businessProfile.products[0].mediaGallery.assetIds.length,1);assert.ok(saved.businessProfile.products[0].mediaGallery.mainAssetId);
   await freshCard(storedUploads[1].asset.assetId).getByRole('button',{name:'Add to gallery',exact:true}).click();
   await freshCard(storedUploads[0].asset.assetId).getByRole('button',{name:'Move later',exact:true}).click();
   for(const language of ['en','es','fr','ar','pt','zh','hi','de','ja']){await page.locator('#owner-preparation-language').selectOption(language);const expected=require('../js/vendor-inventory-copy').copy[language];assert.ok((await page.locator('#business-media-list').textContent()).includes(expected.removeGallery));assert.equal(await page.locator('#business-media-product option[value=""]').textContent(),expected.chooseProduct);await page.evaluate(()=>{window.__originalConfirm=window.confirm;window.confirm=message=>{window.__removePrompt=message;return false;};});await page.locator('.business-product-card-actions button').filter({hasText:'Remove'}).first().click();assert.equal(await page.evaluate(()=>window.__removePrompt),expected.removeProduct.replace('{name}','Exact jacket'));await page.evaluate(()=>window.confirm=window.__originalConfirm);assert.equal(await page.locator('.business-product-card-actions button[data-vendor-copy=duplicate]').first().textContent(),expected.duplicate);}
   await page.locator('#owner-preparation-language').selectOption('en');
   const expectedOrder=await page.evaluate(()=>window.DEMEOSVendorProducts.read().products[0].mediaGallery.assetIds);
   await page.route('**/products',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Controlled save failure. Your edits are retained.'}}):route.continue());
   await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent.includes('retained'));
   assert.deepEqual(await page.evaluate(()=>window.DEMEOSVendorProducts.read().products[0].mediaGallery.assetIds),expectedOrder);
   assert.equal((await repository.getKnownBusiness(profile.businessId)).businessProfile.products[0].mediaGallery.assetIds.length,1);
   await page.unroute('**/products');await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');
   assert.deepEqual((await repository.getKnownBusiness(profile.businessId)).businessProfile.products[0].mediaGallery.assetIds,expectedOrder);
   // Saved references remain visible beyond the recent-upload cap, through API and reopening.
   for(let index=0;index<101;index++)await repository.saveBusinessMediaAsset(profile.businessId,{...asset,assetId:'recent-'+viewport.width+'-'+index,relatedEntityId:undefined,purpose:'marketing',createdAt:new Date(Date.now()+index*1000).toISOString()});
   const reopenedAssets=await (await context.request.get(base+'/api/businesses/'+profile.businessId+'/media')).json();
   for(const id of expectedOrder)assert.ok(reopenedAssets.assets.some(asset=>asset.assetId===id));
   const foreign=await context.request.get(base+'/api/businesses/engineering-b/media');assert.equal(foreign.status(),403);
   await page.reload();await page.locator('#vendor-products-save:not([disabled])').waitFor();
   for(const id of expectedOrder){await freshCard(id).getByRole('button',{name:'Remove from gallery',exact:true}).waitFor();await freshCard(id).locator('img').scrollIntoViewIfNeeded();await freshCard(id).locator('img').evaluate(image=>image.decode());assert.equal(await freshCard(id).locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true);}
   assert.deepEqual(await page.evaluate(()=>window.DEMEOSVendorProducts.read().products[0].mediaGallery.assetIds),expectedOrder);
   await freshCard(storedUploads[0].asset.assetId).getByRole('button',{name:'Main image',exact:true}).waitFor();
   assert.deepEqual(await page.locator('.business-media-item').filter({has:page.getByRole('button',{name:'Remove from gallery',exact:true})}).locator('img').evaluateAll(images=>images.map(image=>image.src)),expectedOrder.map(id=>'https://example.org/'+id+'.webp'));
   // Hold the real product response so navigation happens while the save is pending.
   let releaseProductResponse;const productResponseHeld=new Promise(resolve=>releaseProductResponse=resolve);
   await page.route('**/products',async route=>{if(route.request().method()!=='PUT')return route.continue();const response=await route.fetch();await productResponseHeld;return route.fulfill({response});});
   await page.locator('.business-product-card-actions button').filter({hasText:'Duplicate'}).first().click();await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();assert.equal(await page.locator('#vendor-products-status').textContent(),'Loading…');await page.goto(base+'/marketing.html#inventory');releaseProductResponse();
   await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');await page.unroute('**/products');
   const catalog=await repository.getKnownBusiness(profile.businessId),duplicate=catalog.businessProfile.products.at(-1);assert.equal(duplicate.customerVisible,false);assert.notEqual(duplicate.productId,'offer-a');assert.equal(duplicate.mediaGallery,undefined);
   await page.goto(base+'/marketing.html#inventory');await page.locator('.vendor-stock-row').first().waitFor();
   const beforeBulk=await repository.getVendorInventory(profile.businessId),bulkRows=require('../api/_lib/vendor-inventory').rowsFor(catalog.businessProfile,beforeBulk.entries);
   const csv=[['productId','variantId','onHand','lowStock','sku'],...bulkRows.map((row,index)=>[row.productId,row.variantId,Number(count)+index+2,4,'bulk-'+viewport.width+'-'+index])].map(row=>row.map(require('../js/vendor-inventory').csvCell).join(',')).join('\r\n');
   await page.locator('#vendor-stock-import').setInputFiles({name:'stock.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent.includes('Unsaved'));
   assert.equal((await repository.getVendorInventory(profile.businessId)).revision,beforeBulk.revision);
   await page.locator('#vendor-stock-reason').fill('Reviewed CSV count');await page.locator('#vendor-stock-save').click();assert.equal((await repository.getVendorInventory(profile.businessId)).revision,beforeBulk.revision);
   await page.locator('#vendor-stock-review button').first().click();await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent==='Stock saved.');
   const afterBulk=await repository.getVendorInventory(profile.businessId);assert.equal(afterBulk.revision,beforeBulk.revision+1);assert.equal(afterBulk.history[0].changes.length,2);
   for(const [index,row] of bulkRows.entries())assert.equal(afterBulk.entries[JSON.stringify([row.productId,row.variantId])].onHand,Number(count)+index+2);
   await page.goto(base+'/marketing.html#products');await page.locator('#vendor-products-save:not([disabled])').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:'/tmp/demeos-owner-vendor-catalogue-'+viewport.width+'.png',fullPage:true});
   await page.goto(base+'/marketing.html#orders');await page.locator('.vendor-order-row').waitFor();await page.evaluate(()=>window.Clerk.signOut());await page.locator('#owner-auth-signed-out:not([hidden])').waitFor();await page.waitForFunction(()=>document.getElementById('vendor-orders-list').textContent==='');await context.clearCookies();assert.equal((await context.request.get(base+'/api/businesses/engineering-a/orders')).status(),401);
   assert.deepEqual(errors,[]);await context.close();
   // Restore exact catalogue for the next device without clearing stock history.
   await repository.saveBusiness(profile);
   await database.query("DELETE FROM demeos_business_media_assets WHERE business_id=$1 AND asset_id LIKE 'recent-%'",[profile.businessId]);
  }
  console.log('Vendor inventory: SQL/API/rendered stock, reload, private gallery, duplication, Japanese and responsive checks passed at 390/820/1440.');
 }finally{await browser.close();server.close();await client.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
