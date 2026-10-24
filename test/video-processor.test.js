'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createProcessor,allowedUrl}=require('../tools/video-processor/processor');
const {createServer}=require('../tools/video-processor/server');
test('video worker requires exact HTTPS storage hosts and rejects URL credentials, ports and suffix lookalikes',()=>{
 for(const url of ['http://store.example/a','https://store.example.evil/a','https://user:secret@store.example/a','https://store.example:444/a','https://127.0.0.1/a'])assert.throws(()=>allowedUrl(url,['store.example']));
 assert.equal(allowedUrl('https://store.example/a?temporary=capability',['store.example']),'https://store.example/a?temporary=capability');
 assert.throws(()=>createProcessor());assert.throws(()=>createServer({token:'short'}));
});
test('video worker rejects cross-business outputs and expired sources before fetching bytes',async()=>{
 let fetched=false;const processor=createProcessor({hosts:['store.example'],fetchImpl:async()=>{fetched=true;throw Error();}});
 const payload={businessId:'shop',assetId:'video',storageKey:'businesses/shop/media/video/original',sourceUrl:'https://store.example/source',sourceExpiresAt:new Date(Date.now()-1).toISOString()};
 await assert.rejects(()=>processor('inspect',payload),/Expired/);
 await assert.rejects(()=>processor('transcode',{...payload,outputDestinations:['master','customer','marketing'].map(role=>({role,contentType:'video/mp4',storageKey:'businesses/another/media/video/processed/'+role+'.mp4'}))}),/Unscoped/);
 assert.equal(fetched,false);
});
test('video worker fails closed when a private source exceeds the byte limit',async()=>{
 const processor=createProcessor({hosts:['store.example'],fetchImpl:async()=>new Response('not video',{headers:{'content-length':String(251*1024*1024)}})});
 await assert.rejects(()=>processor('inspect',{businessId:'shop',assetId:'video',storageKey:'businesses/shop/media/video/original',sourceUrl:'https://store.example/source',sourceExpiresAt:new Date(Date.now()+300000).toISOString()}),/too large/);
});

test('trusted encoding deadline remains bounded and terminates a stuck subprocess',async()=>{
 for(const transcodeTimeoutMs of [NaN,Infinity,0,999,90001,'90000'])assert.throws(()=>createProcessor({hosts:['store.example'],transcodeTimeoutMs}),/deadline/);
 const {run}=require('../tools/video-processor/processor');
 const started=Date.now();
 await assert.rejects(()=>run(process.execPath,['-e','setInterval(()=>{},1000)'],100),error=>error.killed===true&&error.signal==='SIGKILL');
 assert.ok(Date.now()-started<5000,'timed-out encoding cannot retain the worker slot indefinitely');
});


test('media subprocesses never inherit hosting or storage credentials',async()=>{
 const {run}=require('../tools/video-processor/processor');
 const keys=['BLOB_READ_WRITE_TOKEN','POSTGRES_URL','CLERK_SECRET_KEY','DEMEOS_MEDIA_PROCESSING_TOKEN'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  for(const key of keys)process.env[key]='isolated-secret-must-not-reach-decoder';
  const child=JSON.parse(await run(process.execPath,['-e','process.stdout.write(JSON.stringify(process.env))'],5000));
  for(const key of keys)assert.equal(child[key],undefined,key+' must remain in the authenticated parent');
  assert.equal(child.LC_ALL,'C');
 }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
