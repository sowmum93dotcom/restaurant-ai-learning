'use strict';
// Actual owner APIs/repository/SQL with an isolated identity-provider adapter.
// No production account, business, publication or external provider is used.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>{const id=req.headers.cookie?.match(/engineering-owner=(owner-[a-z0-9-]+)/)?.[1];return id?{trustedIdentityId:id}:null;};
// Isolated Blob transport; native inspection, conversion, queue, SQL and routes are real.
process.env.DEMEOS_MEDIA_UPLOAD_SECRET='isolated-native-upload-secret-32-bytes';
process.env.DEMEOS_MEDIA_STORAGE_PROVIDER='vercel-blob';process.env.DEMEOS_MEDIA_PROCESSING_PROVIDER='native';
const objects=new Map(),tasks=[];
globalThis[Symbol.for('@vercel/request-context')]={get:()=>({waitUntil:promise=>tasks.push(promise)})};
const address=key=>'https://native.private.blob.vercel-storage.com/'+encodeURIComponent(key);
const rawStorage={
 async createDeliveryRead({storageKey,expiresAt}){return{storageKey,expiresAt,deliveryUrl:address(storageKey)+'?renewed='+Date.now()};},
 async createProcessingRead({storageKey,expiresAt}){return{storageKey,expiresAt,readUrl:address(storageKey)};},
 async createProcessingWrite(out){return{...out,uploadUrl:address(out.storageKey)};},
 async verifyUpload({storageKey}){const o=objects.get(storageKey);return o?{exists:true,storageKey,contentType:o.type,sizeBytes:o.bytes.length}:null;}
};
const storage=require('../api/_lib/media-storage-driver');
storage.createVercelBlobStorageDriver=()=>rawStorage;
storage.getConfiguredMediaStorageAdapter=()=>({
 ...rawStorage,
 async createUpload(asset){const storageKey='businesses/'+asset.businessId+'/media/'+asset.assetId+'/original';return{storageKey,uploadUrl:address(storageKey)};},
 async verifyUpload(asset,key){const o=objects.get(key);return o&&o.bytes.length===asset.sizeBytes&&o.type===asset.contentType?{storageKey:key,contentType:o.type,sizeBytes:o.bytes.length}:null;}
});
require('../api/_lib/media-processing-driver').getConfiguredMediaProcessingDrivers=()=>require('../api/_lib/native-media-processing').createNativeMediaProcessingDrivers({storage:rawStorage,async fetchImpl(url,options={}){
 const key=decodeURIComponent(new URL(url).pathname.slice(1));
 if(options.method==='PUT'){objects.set(key,{bytes:options.body,type:options.headers['Content-Type']});return new Response('',{status:200});}
 const o=objects.get(key);return new Response(o?.bytes||null,{status:o?200:404});
}});
const completeMedia=require('../api/businesses/[businessId]/media/[assetId]');
const list=require('../api/businesses'),business=require('../api/businesses/[businessId]'),campaign=require('../api/businesses/[businessId]/campaigns/[campaignId]'),media=require('../api/businesses/[businessId]/media/index'),publicWork=require('../api/customer/work');
const checkout=require('../api/_lib/customer-checkout').createHandler({authenticate:async req=>{const identity=await auth.resolveTrustedIdentityFromRequest(req);return identity?{trustedCustomerIdentityId:identity.trustedIdentityId}:null;},repository:()=>repository});
const generatorModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/generate.js'),'utf8').replace('export default async function handler','module.exports = async function handler'),{module:generatorModule,require:createRequire(path.join(root,'api/generate.js')),console,process:{env:{}},fetch(){throw Error('No external provider may be called');}});
const asset={businessId:'engineering-a',assetId:'engineering-image',relatedEntityId:'offer-a',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
const profile={applicationAccess:{marketing:false,selling:true},businessId:'engineering-a',name:'Engineering Owner A',type:'Fashion',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share saved products',profileVersion:4,preparationModel:'selling',offeringCategoryId:'fashion.apparel',productsServices:'Owner products',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'engineering-a',productId:'offer-a',name:'Exact jacket',description:'Saved jacket description',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:true,fulfilment:{methods:['collection']},presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'exact-medium',selection:{size:'M'},availability:'limited',pricing:{mode:'fixed',currency:'GBP',amount:91},future:'retained'}],future:'retained'}}]};
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
 const file=path.resolve(root,'.'+decodeURIComponent(({'/marketing-business':'/business-workspace.html','/selling-vendor':'/selling-vendor.html','/marketing-business/manage':'/marketing.html','/selling-vendor/manage':'/selling-vendor-manage.html','/selling-vendor/onboarding':'/selling-vendor-manage.html','/marketing-business/results':'/business-results.html'}[url.pathname] || (url.pathname==='/'?'/business-workspace.html':url.pathname))));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});
(async()=>{
 let browser;
 try{
  await database.ensureSchema();await repository.createBusinessForOwner('owner-a',profile);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const directory=await require('node:fs/promises').mkdtemp('/tmp/demeos-native-browser-');
  const png=await require('sharp')({create:{width:480,height:320,channels:3,background:'#10253e'}}).png().toBuffer();
  const video=path.join(directory,'upload.mp4');
  await require('node:util').promisify(require('node:child_process').execFile)(require('ffmpeg-static'),['-v','error','-f','lavfi','-i','color=c=blue:s=480x320:d=1','-c:v','libx264','-pix_fmt','yuv420p',video]);
  const engine=process.env.DEMEOS_BROWSER_ENGINE==='webkit'?require('playwright').webkit:chromium;
  browser=await engine.launch({headless:true,executablePath:process.env.DEMEOS_BROWSER_EXECUTABLE});
  for(const width of [390,820,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'engineering-owner',value:'owner-a',url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:"window.Clerk={user:{id:'owner-a'},session:null,async load(){},addListener(fn){this.listener=fn}};"}));
   await context.route('https://native.private.blob.vercel-storage.com/**',async route=>{
    const req=route.request(),key=decodeURIComponent(new URL(req.url()).pathname.slice(1));
    if(req.method()==='PUT'){objects.set(key,{bytes:req.postDataBuffer(),type:req.headers()['content-type']});return route.fulfill({status:200});}
    const o=objects.get(key);return route.fulfill({status:o?200:404,contentType:o?.type||'text/plain',body:o?.bytes||''});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
   await page.goto(base+'/selling-vendor/manage#media');await page.locator('body[data-owner-access=ready]').waitFor();
   await page.locator('#business-media-product').selectOption('offer-a');
   const baseline=(await repository.getBusinessMediaAssets(profile.businessId)).length;
   await page.locator('#business-media-file').setInputFiles([{name:'native-'+width+'.png',mimeType:'image/png',buffer:png},{name:'native-'+width+'.mp4',mimeType:'video/mp4',buffer:fs.readFileSync(video)}]);
   await page.locator('#business-media-upload-btn').click();
   await page.waitForFunction(count=>Array.from(document.querySelectorAll('.business-media-item')).filter(x=>/Ready/.test(x.textContent)).length>=count,baseline+2,{timeout:60000});
   const assets=await repository.getBusinessMediaAssets(profile.businessId);assert.equal(assets.length,baseline+2);assert.ok(assets.every(a=>a.state==='ready'&&a.processedStorageKey&&a.derivatives.length>=2));
   const newAssets=assets.slice(0,2);const image=newAssets.find(a=>a.kind==='image'),clip=newAssets.find(a=>a.kind==='video');assert.ok(image&&clip);
   const imageCard=page.locator('.business-media-item').filter({has:page.locator('img[src*="'+image.assetId+'"]')});await imageCard.getByRole('button',{name:'Add to gallery',exact:true}).click();await imageCard.getByRole('button',{name:'Set as main image',exact:true}).click();
   await page.locator('.business-media-item').filter({has:page.locator('video[src*="'+clip.assetId+'"]')}).getByRole('button',{name:'Add to gallery',exact:true}).click();
   await page.locator('[data-owner-section=products]').click();await page.locator('#vendor-products-save:not([disabled])').waitFor();
   await page.locator('#vendor-products-confirm').check();await page.locator('#vendor-products-save').click();await page.locator('#vendor-products-status').filter({hasText:'Products saved'}).waitFor();
   const saved=(await repository.getKnownBusiness(profile.businessId)).businessProfile.products[0].mediaGallery;assert.ok(saved.assetIds.includes(image.assetId)&&saved.assetIds.includes(clip.assetId));assert.equal(saved.mainAssetId,image.assetId);
   await page.reload();await page.locator('body[data-owner-access=ready]').waitFor();await page.locator('.business-product-card img').first().waitFor();
   await page.goto(base+'/selling-vendor/manage#media');await page.locator('.business-media-item video').first().waitFor();
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.business-media-item img')).every(i=>i.complete&&i.naturalWidth>0));
   const codec=await page.locator('.business-media-item video').first().evaluate(v=>v.canPlayType('video/mp4; codecs="avc1.42E01E"'));
   if(!codec&&process.env.DEMEOS_MEDIA_BROWSER_CODEC_CHECK==='metadata-only')console.log('Playback remains unverified in this Chromium build: H.264 codec is unavailable.');
   else{await page.locator('.business-media-item video').first().evaluate(v=>{v.muted=true;return v.play();});await page.waitForFunction(()=>document.querySelector('.business-media-item video').ended,{timeout:15000});}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   await page.screenshot({path:'/tmp/demeos-native-vendor-media-'+width+'.png',fullPage:true});console.log('Native image/video upload, processing, gallery save and reload passed; playback '+(codec?'verified':'pending'),width);await context.close();
  }
  await Promise.allSettled(tasks);await require('node:fs/promises').rm(directory,{recursive:true,force:true});
 }catch(error){console.error(error);process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await client.close();}
})();
