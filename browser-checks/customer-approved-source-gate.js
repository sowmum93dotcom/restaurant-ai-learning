// Browser -> real HTTP handlers -> existing repository -> isolated PostgreSQL.
// Engineering fixtures stay in-process; no production data or provider activation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const persistence=require('../api/_lib/persistence');
const {sourceRow}=require('../test/fixtures/approved-search-source.cjs');
const root=path.resolve(__dirname,'..'),client=new PGlite(),database=createDatabase(client);
const repository=persistence.createPersistenceRepository(database,{reportCatalogueDiagnostics:()=>{}});
persistence.getRepository=()=>repository;
const search=require('../api/customer/possibilities'),config=require('../api/public-config'),publicWork=require('../api/customer/work');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);req.headers=req.headers || {};
  let body='';for await(const chunk of req){body+=chunk;if(body.length>10000){res.writeHead(413);res.end();return;}}req.body=body?JSON.parse(body):{};
  res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
  if(url.pathname==='/api/customer/possibilities'){return await search(req,res);}
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
 await database.ensureSchema();
 for(let index=0;index<62;index++){
  const row=sourceRow(index,{service:index===61});
  if(index<60)row.profile.products[0].availability='unavailable';
  await database.query('INSERT INTO demeos_businesses (business_id,profile) VALUES ($1,$2)',[row.business_id,JSON.stringify(row.profile)]);
  // The eligible product/service deliberately sit on the second database page.
  await database.query('INSERT INTO demeos_campaigns (campaign_id,business_id,campaign,approved_at,updated_at) VALUES ($1,$2,$3,$4,$5)',[row.campaign_id,row.business_id,JSON.stringify(row.campaign),row.approved_at,new Date(Date.parse(row.approved_at)-index*1000)]);
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   // Verify the accessible result action without racing the decorative 3D animation.
   const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   async function request(text){
    await page.goto(base+'/customer.html#intention');
    await page.locator('#customer-intention-text').fill(text);
    await page.locator('#customer-intention-form button[type="submit"]').click();
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/customer/possibilities' && r.request().method()==='POST');
    await page.locator('#customer-understanding-confirm').click();
    const delivered=await response;assert.equal(delivered.status(),200);
    const body=await delivered.json();
    if(text.includes('Cleaning Services'))assert.equal(body.possibilities[0].products[0].productId,'fixture-offer-61');
    else if(text.includes('under £100'))assert.equal(body.possibilities[0].products[0].productId,'fixture-offer-60');
    else assert.deepEqual(body.possibilities,[]);
   }
   await request('Fashion and Apparel Commerce black waterproof jacket under £100');
   const result=page.locator('#customer-possibilities-list .customer-possibility-surface');await result.filter({hasText:'Engineering source 60'}).waitFor();assert.equal(await result.count(),1);
   assert.match(await result.innerText(),/Engineering source 60/);await result.press('Enter');
   await page.locator('#customer-focused-possibility[data-work-item-id="fixture-campaign-060"]:not([hidden])').waitFor();
   await page.locator('#customer-focused-possibility [data-product-id="fixture-offer-60"] .customer-product-continue-action, #customer-focused-possibility [data-product-id="fixture-offer-60"] .customer-item-details').first().click();
   await page.locator('#product-experience:not([hidden])').waitFor();
   assert.equal(await page.locator('#product-experience-title').textContent(),'Black waterproof jacket');
   assert.equal(await page.locator('#product-experience-business').textContent(),'Engineering source 60');
   const size=page.locator('#product-experience-options select[data-option-key="size"]');
   if(await size.isEnabled())await size.selectOption('M');
   assert.equal(await size.inputValue(),'M');
   assert.equal(await page.locator('#product-experience-action').getAttribute('href'),'https://example.org/shop');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:'/tmp/demeos-genuine-search-'+viewport.width+'.png'});
   await request('Cleaning Services cleaning appointment');await result.filter({hasText:'Engineering source 61'}).waitFor();assert.equal(await result.count(),1);await result.press('Enter');
   await page.locator('#customer-focused-possibility[data-work-item-id="fixture-campaign-061"]:not([hidden])').waitFor();
   await page.locator('#customer-focused-possibility [data-product-id="fixture-offer-61"] .customer-product-continue-action, #customer-focused-possibility [data-product-id="fixture-offer-61"] .customer-item-details').first().click();
   await page.locator('#product-experience:not([hidden])').waitFor();assert.equal(await page.locator('#product-experience-title').textContent(),'Cleaning Services');assert.equal(await page.locator('#product-experience-action').getAttribute('href'),'https://example.org/book');
   await request('Fashion and Apparel Commerce jacket under £50');await page.locator('#customer-no-possibilities:not([hidden])').waitFor();assert.equal(await result.count(),0);
   assert.deepEqual(errors,[]);console.log('Approved source SQL/HTTP/browser continuation passed',viewport.width);await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await client.close();}
})().catch(error=>{console.error(error);server.close();client.close();process.exit(1);});
