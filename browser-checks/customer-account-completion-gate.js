'use strict';
// Isolated provider adapter and private records. Never logs in a real person,
// writes deployed data or substitutes for server authorization/security tests.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {LOCALES}=require('../api/_lib/customer-evidence-provenance');
const base=process.env.DEMEOS_BROWSER_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   let authenticated=false,signIns=0,preferences=[],controls={usePreferencesAsGuidance:false,useFeedbackAsGuidance:false};
   page.on('pageerror',e=>errors.push(String(e)));
   await context.route('**/api/public-config',route=>route.fulfill({json:{clerkPublishableKey:'pk_test_'+Buffer.from('clerk.test$').toString('base64')}}));
   await context.route('https://clerk.test/npm/@clerk/ui@1/dist/ui.browser.js',route=>route.fulfill({contentType:'text/javascript',body:'window.__internal_ClerkUICtor={};'}));
   await context.route('https://clerk.test/npm/@clerk/clerk-js@6/dist/clerk.browser.js',route=>route.fulfill({contentType:'text/javascript',body:`window.Clerk={user:sessionStorage.getItem('completion-auth')?{}:null,async load(){},__internal_updateProps(){},addListener(fn){this.listener=fn;},async openSignIn(options){if(!options.withSignUp)throw Error('Single sign-in must include account creation');await fetch('/completion-auth');sessionStorage.setItem('completion-auth','1');this.user={};await this.listener();},async signOut(){await fetch('/completion-signout');sessionStorage.removeItem('completion-auth');this.user=null;await this.listener();}};`}));
   await context.route('**/completion-auth',r=>{authenticated=true;signIns++;return r.fulfill({json:{ok:true}});});
   await context.route('**/completion-signout',r=>{authenticated=false;return r.fulfill({json:{ok:true}});});
   await context.route('**/api/customer/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==='/api/customer/identity')return route.fulfill({json:{authenticated}});
    if(path==='/api/customer/work')return route.fulfill({json:{work:[],testMode:false,customerPackages:[]}});
    if(!authenticated)return route.fulfill({status:401,json:{error:'Authentication required'}});
    if(path==='/api/customer/preferences'){
     if(request.method()==='POST')preferences.push({preferenceId:'isolated-'+preferences.length,preference:request.postDataJSON().preference,createdAt:'2026-10-09T00:00:00Z'});
     return route.fulfill({json:{preferences}});
    }
    if(path==='/api/customer/privacy-controls'){
     if(request.method()==='POST')controls=request.postDataJSON();
     assert.deepEqual(Object.keys(controls).sort(),['useFeedbackAsGuidance','usePreferencesAsGuidance']);
     return route.fulfill({json:{controls}});
    }
    if(path==='/api/customer/intentions')return route.fulfill({json:{intentions:[]}});
    if(path==='/api/customer/participation')return route.fulfill({json:{participations:[]}});
    if(path==='/api/customer/possibilities/saved')return route.fulfill({json:{possibilities:[{savedPossibilityId:'isolated-saved',workItemId:'isolated-work',businessName:'Private engineering business',content:'Saved selection',issuedAt:'2026-10-09T00:00:00Z',products:[{productId:'isolated-offer',name:'Exact saved offer',description:'Historical owner information',price:'£89',priceMode:'fixed',availability:'limited'}]}]}});
    return route.fulfill({status:404,json:{error:'Not found'}});
   });
   await page.goto(base+'/my-demeos.html');
   await page.locator('#customer-auth-signed-out:not([hidden])').waitFor();
   await page.locator('#customer-sign-in').click();
   await page.locator('#customer-auth-signed-in:not([hidden])').waitFor();
   assert.equal(signIns,1);
   for(const locale of LOCALES){
    await page.locator('#customer-language').selectOption(locale);
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');
    await page.locator('#open-my-preferences').click();
    await page.locator('#customer-preference').fill('Quiet places '+locale);
    await page.locator('#my-preferences-form button[type="submit"]').click();
    await page.waitForFunction(text=>document.getElementById('my-preferences-list').textContent.includes(text),'Quiet places '+locale);
    await page.locator('#my-preferences [data-relationship-back]').click();
    await page.locator('[data-relationship-area="privacy-control"]').click();
    await page.locator('#use-preferences-as-guidance').setChecked(true);
    await page.locator('#use-feedback-as-guidance').setChecked(false);
    const label=await page.locator('#use-preferences-as-guidance').locator('..').boundingBox();
    assert.ok(label.height>=44,'privacy label remains a readable touch target');
    if(locale==='en'||locale==='ar')await page.screenshot({path:'/tmp/demeos-account-'+viewport.width+'-'+locale+'.png'});
    await page.locator('#privacy-controls-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('privacy-controls-form').dataset.loadedPreferencesGuidance==='true');
    assert.deepEqual(controls,{usePreferencesAsGuidance:true,useFeedbackAsGuidance:false});
    await page.locator('#privacy-control [data-relationship-back]').click();
    await page.locator('#open-my-possibilities').click();
    assert.match(await page.locator('#my-possibilities-list').innerText(),/Private engineering business/);
    assert.match(await page.locator('#my-possibilities-list').innerText(),/Exact saved offer/);
    assert.match(await page.locator('#my-possibilities-list').innerText(),/£89/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#my-possibilities [data-relationship-back]').click();
   }
   await page.locator('#customer-sign-out').click();
   await page.locator('#customer-auth-signed-out:not([hidden])').waitFor();
   assert.doesNotMatch(await page.locator('body').innerText(),/Private engineering business|Exact saved offer|Quiet places/);
   await page.locator('.customer-journey-nav a').first().click();
   await page.locator('#customer-work-list[data-controlled-test="false"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.customer-work-card').count(),0);
   assert.deepEqual(errors,[]);console.log('Account access, preferences, saved identity, privacy, sign-out and Discover: nine languages passed',viewport.width);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
