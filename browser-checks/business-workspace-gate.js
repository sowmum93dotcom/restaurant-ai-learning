'use strict';
// Actual owner APIs/repository/SQL with an isolated identity-provider adapter.
// No production account, business, publication or external provider is used.
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client),repository=persistence.createPersistenceRepository(database);
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async req=>req.headers.cookie?.includes('engineering-owner=owner-a')?{trustedIdentityId:'owner-a'}:null;
const list=require('../api/businesses'),business=require('../api/businesses/[businessId]'),campaign=require('../api/businesses/[businessId]/campaigns/[campaignId]'),media=require('../api/businesses/[businessId]/media/index'),publicWork=require('../api/customer/work');
const generatorModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/generate.js'),'utf8').replace('export default async function handler','module.exports = async function handler'),{module:generatorModule,require:createRequire(path.join(root,'api/generate.js')),console,process:{env:{}},fetch(){throw Error('No external provider may be called');}});
const asset={businessId:'engineering-a',assetId:'engineering-image',relatedEntityId:'offer-a',purpose:'product',kind:'image',state:'ready',deliveryUrl:'https://example.org/exact.jpg'};
const profile={businessId:'engineering-a',name:'Engineering Owner A',type:'Fashion',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share saved products',profileVersion:4,productsServices:'Owner products',customerContinuation:{routes:['website'],website:'https://example.org/shop'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'engineering-a',productId:'offer-a',name:'Exact jacket',description:'Saved jacket description',price:'£89',priceMode:'fixed',availability:'available',continuationRoute:'website',customerVisible:true,presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[]}}]};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000){res.writeHead(413);res.end();return;}}req.body=raw?JSON.parse(raw):{};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 if(url.pathname==='/api/public-config')return res.json({clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')});
 if(url.pathname==='/api/businesses')return await list(req,res);
 let match=url.pathname.match(/^\/api\/businesses\/([^/]+)(?:\/campaigns\/([^/]+))?$/);
 if(match){req.query.businessId=decodeURIComponent(match[1]);if(match[2]){req.query.campaignId=decodeURIComponent(match[2]);return await campaign(req,res);}return await business(req,res);}
 match=url.pathname.match(/^\/api\/businesses\/([^/]+)\/media$/);if(match){req.query.businessId=match[1];return await media(req,res);}
 if(url.pathname==='/api/generate')return await generatorModule.exports(req,res);
 if(url.pathname==='/api/customer/work')return await publicWork(req,res);
 if(url.pathname.startsWith('/api/'))return res.status(404).json({error:'Not configured'});
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/business-workspace.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}catch(error){console.error(error);if(!res.writableEnded){res.statusCode=500;res.end('{}');}}});
(async()=>{
 await database.ensureSchema();await repository.createBusinessForOwner('owner-a',profile);await repository.createBusinessForOwner('owner-b',{...profile,businessId:'engineering-b',name:'Private Owner B',products:[]});await repository.saveBusinessMediaAsset(profile.businessId,asset);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});await context.addCookies([{name:'engineering-owner',value:'owner-a',url:base}]);
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'text/javascript',body:"window.Clerk={user:sessionStorage.getItem('signed-out')?null:{id:'owner-a'},session:null,async load(){},addListener(fn){this.listener=fn;},openSignIn(){},async signOut(){sessionStorage.setItem('signed-out','1');this.user=null;this.listener({user:null});}};"}));
   await context.route('https://example.org/**',r=>r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',dialog=>dialog.accept());
   await page.goto(base+'/business-workspace.html');await page.locator('#workspace-business-identity').filter({hasText:'Engineering Owner A'}).waitFor();
   assert.equal(await page.locator('.owner-workspace-navigation [data-owner-section]').count(),5);assert.match(await page.locator('#owner-operating-models').innerText(),/Selling is not enabled/);
   assert.equal((await context.request.get(base+'/api/businesses/engineering-b')).status(),403);
   assert.equal((await context.request.post(base+'/api/generate',{data:{businessId:'engineering-b',preparationMode:'business-facts',productId:'offer-a'}})).status(),403);
   assert.equal((await context.request.post(base+'/api/businesses/engineering-a/media',{data:{asset:{kind:'image',purpose:'product',relatedEntityId:'foreign',contentType:'image/png',sizeBytes:100}}})).status(),409);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-overview-'+viewport.width+'.png'});
   await page.locator('[data-owner-section="products"]').click();await page.locator('#business-products-list').filter({hasText:'Exact jacket'}).waitFor();
   assert.equal(new URL(page.url()).hash,'#products');assert.equal(await page.locator('[data-owner-section="products"]').getAttribute('aria-current'),'page');assert.equal(await page.locator('#business-product-id').count(),1);
   await page.locator('#business-products-list button').filter({hasText:'Edit'}).first().click();await page.locator('#business-product-description').fill('Saved jacket description');await page.locator('#business-product-add-btn').click();
   await page.locator('#products-review-save').click();await page.locator('#business-accuracy-confirmation').check();
   const save=page.waitForResponse(r=>r.url().endsWith('/api/businesses/engineering-a')&&r.request().method()==='PUT');await page.locator('#save-business-profile-btn').click();assert.equal((await save).status(),204);
   const stored=await repository.getKnownBusiness('engineering-a');assert.equal(stored.businessProfile.products[0].presentation.options[0].values[0].value,'M');assert.equal(stored.businessProfile.products[0].productId,'offer-a');
   await page.locator('[data-owner-section="marketing"]').click();if (!await page.locator('[data-workspace-view="create"]').isVisible()) await page.locator("#workspace-menu-toggle").click();await page.locator('[data-workspace-view="create"]').click();await page.locator('#draft-product').selectOption('offer-a');await page.locator('#draft-media').selectOption('engineering-image');
   const generated=page.waitForResponse(r=>r.url().endsWith('/api/generate'));await page.locator('#prepare-draft-btn').click();assert.equal((await generated).status(),200);await page.locator('#draft-edit-panel:not([hidden])').waitFor();
   assert.match(await page.locator('#draft-edit-text').inputValue(),/Exact jacket/);assert.match(await page.locator('#draft-edit-text').inputValue(),/£89/);
   await page.locator('#draft-edit-text').fill('Owner reviewed jacket description. £89.');await page.locator('#save-draft-edit').click();await page.locator('#draft-edit-status').filter({hasText:'Draft changes saved'}).waitFor();
   await page.locator('#approve-btn').click();await page.locator('#draft-edit-status').filter({hasText:'Submitted for review'}).waitFor();
   const latest=(await repository.getKnownBusiness('engineering-a')).campaigns.find(c=>c.preparationOnly);assert.equal(latest.approvalStatus,'Unapproved');assert.equal(latest.ownerReviewState,'submitted');assert.equal(latest.media[0].assetId,'engineering-image');
   for(const body of [{campaign:{...latest,preparationOnly:false,approvalStatus:'Approved'}},{action:'reactivate'}]){
    const response=await context.request.fetch(base+'/api/businesses/engineering-a/campaigns/'+latest.id,{method:body.action?'PATCH':'PUT',data:body});assert.equal(response.status(),409);
   }
   assert.deepEqual((await (await context.request.get(base+'/api/customer/work')).json()).work,[]);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-draft-'+viewport.width+'.png'});
   await page.locator('[data-owner-section="results"]').click();await page.locator('#owner-results-metrics .owner-metric').first().waitFor();assert.equal(await page.locator('#owner-results-metrics .owner-metric').count(),5);assert.match(await page.locator('#owner-results-metrics').innerText(),/Not recorded/);assert.doesNotMatch(await page.locator('body').innerText(),/Private Owner B|owner-a|owner-b/);
   await page.screenshot({fullPage:true,path:'/tmp/demeos-owner-results-'+viewport.width+'.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   await page.locator('#owner-sign-out').click();await page.locator('#owner-auth-signed-out:not([hidden])').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/Engineering Owner A|Exact jacket/);assert.deepEqual(errors,[]);
   await context.close();console.log('Owner SQL, model permissions, product/media, factual draft, private submission, results and sign-out passed',viewport.width);
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await client.close();}
})().catch(e=>{console.error(e);process.exit(1);});
