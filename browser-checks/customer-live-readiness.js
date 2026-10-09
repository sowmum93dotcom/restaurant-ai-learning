'use strict';
const {chromium} = require('playwright');
const {verifyEmptyReadiness} = require('./customer-empty-readiness.cjs');

// Explicit stdin config: {url, expectEmpty:true, share?:temporaryVercelShare}.
// No database client, fixture loader, login or business publication operation.
(async()=>{
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const config=JSON.parse(input),base=new URL(config.url);
  if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash||base.username||base.password||config.expectEmpty!==true)throw Error('An HTTPS deployment origin and explicit expectEmpty:true are required');
  const browser=await chromium.launch({headless:true,...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
  const context=await browser.newContext({ignoreHTTPSErrors:process.env.DEMEOS_BROWSER_IGNORE_HTTPS_ERRORS==='1',reducedMotion:'reduce'});
  try {
    if(config.share){
      const page=await context.newPage();
      await page.goto(base.origin+'/?_vercel_share='+encodeURIComponent(config.share));
      await page.close();
    }
    await verifyEmptyReadiness(context,base.origin);
    console.log('Read-only deployment empty-state readiness passed');
  } finally {await context.close();await browser.close();}
})().catch(error=>{
  // Never echo stdin configuration or protected URLs, even on failure.
  console.error(String(error).replace(/_vercel_share=[^\s"']+/g,'_vercel_share=[redacted]'));
  process.exit(1);
});
