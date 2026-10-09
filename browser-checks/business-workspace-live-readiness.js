'use strict';
// Read-only deployed owner gate. No SDK substitution, sign-in, writes,
// database fixtures or publication. Config arrives on stdin, never logged.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 let input='';for await(const chunk of process.stdin)input+=chunk;const config=JSON.parse(input),base=new URL(config.url);
 if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw Error('HTTPS deployment origin required');
 const browser=await chromium.launch({headless:true,...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
 const context=await browser.newContext({ignoreHTTPSErrors:process.env.DEMEOS_BROWSER_IGNORE_HTTPS_ERRORS==='1',reducedMotion:'reduce'});
 try{
  if(config.share){const access=await context.newPage();await access.goto(base.origin+'/?_vercel_share='+encodeURIComponent(config.share));await access.close();}
  for(const endpoint of ['/api/businesses','/api/businesses/engineering-unowned','/api/businesses/engineering-unowned/media']){
   const response=await context.request.get(base.origin+endpoint);assert.equal(response.status(),401,endpoint);assert.match(response.headers()['cache-control'],/private.*no-store/);
  }
  const draft=await context.request.post(base.origin+'/api/generate',{data:{businessId:'engineering-unowned',preparationMode:'business-facts',productId:'offer'}});assert.equal(draft.status(),401);
  const authConfig=await context.request.get(base.origin+'/api/public-config');
  assert.equal(authConfig.status(),config.expectUnavailable===true?503:200);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   await page.setViewportSize(viewport);
   for(const file of ['business-workspace.html','marketing.html','business-results.html']){
    await page.goto(base.origin+'/'+file);await page.locator(config.expectUnavailable===true?'#owner-auth-error:not([hidden])':'#owner-auth-signed-out:not([hidden])').waitFor({timeout:45000});
    assert.equal(await page.locator('#owner-sign-in:visible').count(),config.expectUnavailable===true?0:1);assert.equal(await page.locator('#owner-authenticated-workspace').isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
   console.log(config.expectUnavailable===true?'Preview authentication unavailable boundary and private API isolation passed':'Deployed owner sign-in boundary and private API isolation passed',viewport.width);
  }
  assert.deepEqual(errors,[]);await page.close();console.log('Read-only owner deployment readiness passed');
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(String(error).replace(/_vercel_share=[^\s"']+/g,'_vercel_share=[redacted]'));process.exit(1);});
