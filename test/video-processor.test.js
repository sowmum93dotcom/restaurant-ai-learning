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
