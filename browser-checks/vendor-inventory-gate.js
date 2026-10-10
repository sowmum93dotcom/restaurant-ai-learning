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
const inventory=require('../api/businesses/[businessId]/inventory'),products=require('../api/businesses/[businessId]/products');
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);res.end();return;}}req.body=raw?JSON.parse(raw):{};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 if(url.pathname==='/api/businesses')return await list(req,res);
 const vendorRoute=url.pathname.match(/^\/api\/businesses\/([^/]+)\/(inventory|products)$/);if(vendorRoute){req.query.businessId=vendorRoute[1];return await (vendorRoute[2]==='inventory'?inventory:products)(req,res);}
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
   const count=String(10+viewport.width);await page.locator('.vendor-stock-row input[type=number]').first().fill(count);
   await page.locator('#vendor-stock-reason').fill('Isolated browser count');await page.locator('#vendor-stock-save').click();await page.locator('#vendor-stock-review button').first().click();
   await page.waitForFunction(()=>document.getElementById('vendor-stock-status').textContent==='Stock saved.');
   await page.reload();await page.locator('.vendor-stock-row').first().waitFor();assert.equal(await page.locator('.vendor-stock-row input[type=number]').first().inputValue(),count);
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
   let failedOnce=false;const uploadedNames=[];
   await context.route('https://controlled-upload.example/**',async route=>{
    const id=new URL(route.request().url()).pathname.slice(1),stored=uploads.get(id);assert.equal(stored.asset.businessId,profile.businessId);assert.equal(stored.asset.relatedEntityId,'offer-a');
    const bytes=route.request().postDataBuffer();const text=bytes.toString();uploadedNames.push(text);
    if(text==='retry-file'&&!failedOnce){failedOnce=true;return route.fulfill({status:500});}
    stored.uploaded=true;return route.fulfill({status:200});
   });
   await page.locator('#business-media-product').selectOption('offer-a');
   await page.locator('#business-media-file').setInputFiles([{name:'success.png',mimeType:'image/png',buffer:Buffer.from('success-file')},{name:'retry.png',mimeType:'image/png',buffer:Buffer.from('retry-file')}]);
   await page.locator('#business-media-upload-btn').click();await page.waitForFunction(()=>document.getElementById('business-media-upload-btn').disabled===false);
   assert.match(await page.locator('#business-media-status').textContent(),/retry.png/);
   assert.equal(await page.locator('#business-media-file').evaluate(input=>input.files.length),1);
   await page.locator('#business-media-upload-btn').click();await page.waitForFunction(()=>document.getElementById('business-media-upload-btn').disabled===false);
   assert.deepEqual(uploadedNames,['success-file','retry-file','retry-file']);
   assert.equal(await page.locator('#business-media-file').evaluate(input=>input.files.length),0);
   const storedUploads=[...uploads.values()].filter(x=>x.uploaded);for(const stored of storedUploads){const savedAsset=await repository.getBusinessMediaAsset(profile.businessId,stored.asset.assetId);assert.equal(savedAsset.state,'processing');}
   await page.locator('#business-media-list button').filter({hasText:'Add to gallery'}).first().click();await page.locator('#business-media-list button').filter({hasText:'Set as main image'}).first().click();
   await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');
   const saved=await repository.getKnownBusiness(profile.businessId);assert.equal(saved.businessProfile.products[0].mediaGallery.assetIds.length,1);assert.ok(saved.businessProfile.products[0].mediaGallery.mainAssetId);
   await page.locator('#business-media-list button').filter({hasText:'Add to gallery'}).first().click();
   await page.locator('#business-media-list button').filter({hasText:'Move later'}).first().click();
   const expectedOrder=await page.evaluate(()=>window.DEMEOSVendorProducts.read().products[0].mediaGallery.assetIds);
   await page.route('**/products',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Controlled save failure. Your edits are retained.'}}):route.continue());
   await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent.includes('retained'));
   assert.deepEqual(await page.evaluate(()=>window.DEMEOSVendorProducts.read().products[0].mediaGallery.assetIds),expectedOrder);
   assert.equal((await repository.getKnownBusiness(profile.businessId)).businessProfile.products[0].mediaGallery.assetIds.length,1);
   await page.unroute('**/products');await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');
   assert.deepEqual((await repository.getKnownBusiness(profile.businessId)).businessProfile.products[0].mediaGallery.assetIds,expectedOrder);
   await page.locator('.business-product-card-actions button').filter({hasText:'Duplicate'}).first().click();await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.waitForFunction(()=>document.getElementById('vendor-products-status').textContent==='Products saved.');
   const catalog=await repository.getKnownBusiness(profile.businessId),duplicate=catalog.businessProfile.products.at(-1);assert.equal(duplicate.customerVisible,false);assert.notEqual(duplicate.productId,'offer-a');assert.equal(duplicate.mediaGallery,undefined);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:'/tmp/demeos-owner-vendor-catalogue-'+viewport.width+'.png',fullPage:true});
   assert.deepEqual(errors,[]);await context.close();
   // Restore exact catalogue for the next device without clearing stock history.
   await repository.saveBusiness(profile);
  }
  console.log('Vendor inventory: SQL/API/rendered stock, reload, private gallery, duplication, Japanese and responsive checks passed at 390/820/1440.');
 }finally{await browser.close();server.close();await client.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
