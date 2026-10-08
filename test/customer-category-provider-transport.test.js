'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Readable}=require('node:stream');
const {endpointUrl,publicAddress,createCategoryTransport,MAX_RESPONSE_BYTES}=require('../api/_lib/customer-category-provider-transport');
const requestData=()=>({endpoint:'https://semantic.example.org/category',body:'{"data":"controlled"}',authorization:'Bearer controlled-test-secret',signal:new AbortController().signal,timeoutMs:100});
function mockTransport({address='8.8.8.8',status=200,type='application/json',encoding,bytes=Buffer.from('{}'),hang=false,partial=false}={}){
 let options,destroyed=false;
 const transport=createCategoryTransport({lookup:(_host,_options,done)=>done(null,[{address,family:address.includes(':')?6:4}]),request:(url,opts,callback)=>{
  options=opts;const req=new EventEmitter();req.destroy=()=>{destroyed=true;};
  req.end=()=>queueMicrotask(()=>opts.lookup(url.hostname,{all:true},(error,addresses)=>{
   if(error)return req.emit('error',error);assert.equal(addresses[0].address,address);
   if(hang)return;
   const res=partial?new EventEmitter():Readable.from([bytes]);res.statusCode=status;res.headers={'content-type':type,...(encoding?{'content-encoding':encoding}:{})};res.destroy=()=>{destroyed=true;};callback(res);if(partial)res.emit('aborted');
  }));return req;
 }});
 return {transport,get options(){return options;},get destroyed(){return destroyed;}};
}
test('endpoint accepts only canonical credential-free HTTPS DNS destinations',()=>{
 assert.ok(endpointUrl('https://semantic.example.org/category'));
 for(const url of ['http://semantic.example.org/category','https://127.0.0.1/category','https://[::1]/category','https://localhost/category','https://service.local/category','https://user:secret@semantic.example.org/category','https://semantic.example.org:8443/category','https://semantic.example.org/category?token=secret','https://semantic.example.org/category#fragment','https://SEMANTIC.example.org/category'])assert.equal(endpointUrl(url),null,url);
});
test('DNS guards reject loopback, private, metadata, mapped, reserved and documentation addresses',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','100.64.0.1','169.254.169.254','172.16.0.1','192.168.1.1','192.0.2.1','198.18.0.1','203.0.113.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002::1','3fff::1','not-an-address'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('bounded JSON POST uses checked DNS, normal TLS and minimal authentication headers',async()=>{
 const mock=mockTransport();assert.equal(await mock.transport(requestData()),'{}');assert.equal(mock.options.method,'POST');assert.equal(mock.options.agent,false);assert.equal(mock.options.rejectUnauthorized,true);assert.deepEqual(Object.keys(mock.options.headers).sort(),['accept','authorization','content-length','content-type']);
});
test('private DNS response cannot reach a provider response',async()=>{
 await assert.rejects(mockTransport({address:'169.254.169.254'}).transport(requestData()),/category_transport_failed/);
});
test('redirects, errors, non-JSON, compressed and partial responses fail closed',async()=>{
 for(const options of [{status:302},{status:401},{type:'text/html'},{encoding:'gzip'},{partial:true}])await assert.rejects(mockTransport(options).transport(requestData()),/category_transport_failed/);
});
test('oversized and invalid UTF-8 response bytes are rejected',async()=>{
 await assert.rejects(mockTransport({bytes:Buffer.alloc(MAX_RESPONSE_BYTES+1)}).transport(requestData()),/category_transport_failed/);
 await assert.rejects(mockTransport({bytes:Buffer.from([0xff,0xfe])}).transport(requestData()),/category_transport_failed/);
});
test('aborted input, invalid credential and excessive request never open a connection',async()=>{
 let called=0;const post=createCategoryTransport({request:()=>{called++;throw new Error('unexpected');}});
 const controller=new AbortController();controller.abort();
 for(const patch of [{authorization:'Bearer invalid\r\nsecret'},{body:'x'.repeat(64001)},{signal:controller.signal},{timeoutMs:251}])await assert.rejects(post({...requestData(),...patch}),/category_transport_rejected/);
 assert.equal(called,0);
});
test('timeout and caller abort destroy in-flight requests without returning upstream secrets',async()=>{
 const hanging=mockTransport({hang:true});await assert.rejects(hanging.transport({...requestData(),timeoutMs:5}),/category_transport_failed/);assert.equal(hanging.destroyed,true);
 const mock=mockTransport({hang:true}),controller=new AbortController();const task=mock.transport({...requestData(),signal:controller.signal});controller.abort();await assert.rejects(task,/category_transport_failed/);assert.equal(mock.destroyed,true);
});
test('bounded in-flight capacity rejects overload and recovers after cancellation',async()=>{
 const mock=mockTransport({hang:true}),controllers=Array.from({length:8},()=>new AbortController());
 const tasks=controllers.map(controller=>mock.transport({...requestData(),signal:controller.signal,timeoutMs:250}).catch(error=>error.message));
 await assert.rejects(mock.transport(requestData()),/category_transport_capacity/);
 controllers.forEach(controller=>controller.abort());await Promise.all(tasks);
 const controller=new AbortController(),task=mock.transport({...requestData(),signal:controller.signal});controller.abort();await assert.rejects(task,/category_transport_failed/);
});
