/* Real browser -> existing HTTP handlers -> controlled in-process repository.
 * No production provider, business data, authentication or payments are used. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const work=(id,price)=>({workItemId:id,businessId:'business-'+id,businessName:id==='cheap'?'Supported jacket business':'Over-budget business',content:'Black waterproof jacket',participationAction:'Interested',location:'Manchester',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:'Black jacket',description:'Fashion and Apparel Commerce black waterproof jacket',categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:'10',sectorId:'1'}]},price,availability:'available',continuationRoute:'website'}]});
const opposite=work('opposite','£40');opposite.businessName='Different category business';opposite.products[0].description='Electronics and Devices black waterproof jacket';opposite.products[0].categoryClassification.categories[0].categoryId='11';
const catalogue=[work('expensive','£160'),work('cheap','£89'),opposite];
require('../api/_lib/persistence').getRepository=()=>({getCustomerWork:async()=>catalogue});
require('../api/_lib/demeos-customer-authentication').resolveTrustedCustomerIdentityFromRequest=async()=>null;
const search=require('../api/customer/possibilities'),config=require('../api/public-config'),publicWork=require('../api/customer/work');
let latestRequest;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);req.headers=req.headers || {};
  let body='';for await(const chunk of req){body+=chunk;if(body.length>10000){res.writeHead(413);res.end();return;}}req.body=body?JSON.parse(body):{};
  res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
  if(url.pathname==='/api/customer/possibilities'){latestRequest=req.body;return await search(req,res);}
  if(url.pathname==='/api/customer/understanding'){req.query.resource='customer-understanding';return await config(req,res);}
  if(url.pathname==='/api/customer/work')return await publicWork(req,res);
  if(url.pathname==='/api/customer/identity')return res.json({authenticated:false});
  if(url.pathname.startsWith('/api/'))return res.status(503).json({reason:'unavailable'});
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return;}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');fs.createReadStream(file).pipe(res);
 }catch(_error){if(!res.writableEnded){res.statusCode=500;res.end('{}');}}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/customer.html#intention');await page.locator('#customer-intention-text').fill('waterproof black jacket under £100');await page.locator('#customer-intention-form button[type="submit"]').click();await page.locator('#customer-understanding-confirm').click();
   await page.locator('#customer-possibilities-list .customer-possibility-provider').filter({hasText:'Supported jacket business'}).waitFor();assert.ok(!(await page.locator('#customer-possibilities-list').innerText()).includes('Over-budget business'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#customer-change-intention').click();await page.locator('#customer-intention-text').fill('Fashion and Apparel Commerce black jacket under £100');await page.locator('#customer-intention-form button[type="submit"]').click();await page.locator('#customer-understanding-confirm').click();
   await page.locator('#customer-possibilities-list .customer-possibility-provider').filter({hasText:'Supported jacket business'}).waitFor();const categoryResults=await page.locator('#customer-possibilities-list').innerText();assert.ok(!categoryResults.includes('Different category business'));assert.ok(!categoryResults.includes('Over-budget business'));assert.ok(!categoryResults.includes(DATASET_VERSION));

   const naturalRequest='I need someone to provide food for my wedding';
   await page.locator('#customer-change-intention').click();await page.locator('#customer-intention-text').fill(naturalRequest);await page.locator('#customer-intention-form button[type="submit"]').click();await page.locator('#customer-understanding-confirm').click();
   await page.locator('#customer-no-possibilities:not([hidden])').waitFor();assert.equal(latestRequest.understanding.customerText,naturalRequest);assert.equal(require('../api/_lib/customer-search-registry').getCustomerSearchConfiguration().categoryUnderstanding,null);
   assert.equal(await page.locator('#customer-possibilities-list .customer-possibility-provider').count(),0,'disabled semantics cannot fabricate a catering offer in the jacket catalogue');

   await page.locator('#customer-empty-change-intention').click();await page.locator('#customer-intention-text').fill('I need a service tomorrow near me');await page.locator('#customer-intention-form button[type="submit"]').click();await page.locator('#customer-clarification:not([hidden])').waitFor();assert.equal(await page.locator('#customer-clarification label').textContent(),'Which town or city should we search in?');
   await page.locator('#customer-clarification-text').fill('Manchester');await page.locator('#customer-clarification-button').click();await page.locator('#customer-understanding-confirm').click();await page.locator('#customer-no-possibilities:not([hidden])').waitFor();assert.equal(latestRequest.understanding.customerText,'I need a service tomorrow near me');assert.equal(latestRequest.place,'Manchester');
   assert.deepEqual(errors,[]);console.log('Intelligence HTTP integration gate passed',viewport.width,'budget, category narrowing, natural-request baseline, location clarification, preserved request, verified no-result, no model activation');await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exit(1);});
