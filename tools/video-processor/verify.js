'use strict';
// Real FFmpeg + processor HTTP + shipped Selling API + isolated SQL + playback.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),{PGlite}=require('@electric-sql/pglite');
const {createProcessor}=require('./processor'),{createServer}=require('./server');
const {diskStorage}=require('../../browser-checks/support/private-object-store');
const {createHttpMediaProcessingDrivers}=require('../../api/_lib/media-processing-driver');
const {createHandler}=require('../../api/_lib/selling-dashboard'),{catalogueRevision}=require('../../api/_lib/vendor-inventory');
async function main(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-video-acceptance-')),disk=await diskStorage({blobProtocol:true});
 const db=new PGlite(),repo=require('../../api/_lib/persistence').createPersistenceRepository(require('../../api/_lib/database').createDatabase(db));
 const token='isolated-video-processor-token-at-least-32-characters',processor=createProcessor({hosts:['storage.gate'],fetchImpl:disk.fetchImpl});
 const server=createServer({token,processor});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const driverFetch=(url,options)=>fetch(String(url).replace('https://processor.fixture',base),options);
 const video=createHttpMediaProcessingDrivers({baseUrl:'https://processor.fixture',token,fetchImpl:driverFetch,timeoutMs:45000});
 const backend={...disk,drivers:{...disk.drivers,inspectVideo:video.inspectVideo,transcodeVideo:video.transcodeVideo}};
 const env={VERCEL_ENV:'production',DEMEOS_MEDIA_UPLOAD_SECRET:'isolated-video-upload-secret-at-least-32-characters'};
 const previousSecret=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;process.env.DEMEOS_MEDIA_UPLOAD_SECRET=env.DEMEOS_MEDIA_UPLOAD_SECRET;
 const businessId='video-owner-business',owner='video-owner';
 let browser,playbackServer;
 try{
  assert.equal((await fetch(base+'/inspect/video',{method:'POST',body:'{}'})).status,401);
  await repo.createBusinessForOwner(owner,{businessId,name:'Isolated video fixture',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[]});
  async function call(action,product,identity=owner){
   const profile=(await repo.getKnownBusiness(businessId)).businessProfile;
   const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
   await createHandler({repository:()=>repo,environment:()=>env,mediaBackend:()=>backend,authenticate:async()=>({trustedIdentityId:identity})})({method:'POST',query:{businessId},body:{action,product,catalogueRevision:catalogueRevision(profile)}},res);return res;
  }
  assert.equal((await call('save-product',{productId:'video-product',name:'Video product',description:'Isolated verification',priceMode:'contact',price:'',availability:'contact'})).code,200);
  const playable=[];
  for(const [index,seconds,audio] of [[1,3,true],[2,60,false]]){
   const file=path.join(dir,'input-'+index+'.mov');
   await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30',...(audio?['-f','lavfi','-i','sine=frequency=440:sample_rate=48000']:[]),'-t',String(seconds),'-c:v','mpeg4','-q:v','5',...(audio?['-c:a','pcm_s16le']:[]),file],{timeout:30000});
   const bytes=await fs.readFile(file),item={productId:'video-product',assetId:'media-real-video-'+index,kind:'video',contentType:'video/quicktime',sizeBytes:bytes.length};
   const registered=await call('register-media',item);assert.equal(registered.code,201);
   assert.equal((await call('complete-media',{...item,...registered.body.uploadSession},'other-owner')).code,403);
   const upload=registered.body.uploadSession;await disk.fetchImpl(upload.uploadUrl,{method:'PUT',headers:upload.headers,body:bytes});
   const start=Date.now(),completed=await call('complete-media',{...item,storageKey:upload.storageKey,uploadToken:upload.uploadToken});
   assert.equal(completed.code,200,JSON.stringify(completed.body));
   const saved=await repo.getBusinessMediaAsset(businessId,item.assetId);assert.equal(saved.state,'ready');assert.equal(saved.derivatives.length,2);assert.ok(saved.width&&saved.height);
   const profile=(await repo.getKnownBusiness(businessId)).businessProfile;assert.ok(profile.products[0].mediaGallery.assetIds.includes(item.assetId));assert.equal(profile.products[0].customerVisible,false);
   const encoded=await fs.readFile(disk.file(saved.processedStorageKey)),output=path.join(dir,'output-'+index+'.mp4');await fs.writeFile(output,encoded);
   const metadata=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',output])).stdout);
   assert.equal(metadata.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(metadata.streams.find(s=>s.codec_type==='video').pix_fmt,'yuv420p');
   if(audio)assert.equal(metadata.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
   assert.ok(encoded.indexOf(Buffer.from('moov'))<encoded.indexOf(Buffer.from('mdat')),'MP4 metadata precedes media for fast-start playback');
   for(const d of saved.derivatives)assert.ok((await disk.driver.verifyUpload({storageKey:d.storageKey})).exists);
   playable.push(encoded);console.log(`Real MOV → H.264/AAC, SQL ready/link, 3 private outputs: ${seconds}s in ${Date.now()-start}ms`);
  }
  if(process.argv.includes('--browser')){
   const {chromium}=require('playwright');
   playbackServer=http.createServer((req,res)=>{
    if(req.url==='/video.mp4'){const bytes=playable[0];res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':bytes.length});return res.end(bytes);}
    res.setHeader('Content-Type','text/html');res.end('<video src="/video.mp4" muted controls playsinline></video>');
   });await new Promise(r=>playbackServer.listen(0,'127.0.0.1',r));
   browser=await chromium.launch({headless:true,...(process.env.DEMEOS_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.DEMEOS_BROWSER_EXECUTABLE_PATH}:{channel:process.env.DEMEOS_BROWSER_CHANNEL||'chrome'}),args:['--no-sandbox']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+playbackServer.address().port);
   await page.locator('video').evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>1);
   assert.equal(await page.locator('video').evaluate(v=>v.error),null);console.log('Encoded video decodes and plays in Chromium');
  }
 }finally{
  await browser?.close();if(playbackServer)await new Promise(r=>playbackServer.close(r));await new Promise(r=>server.close(r));await db.close();
  await fs.rm(dir,{recursive:true,force:true});await fs.rm(disk.root,{recursive:true,force:true});
  if(previousSecret===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=previousSecret;
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
