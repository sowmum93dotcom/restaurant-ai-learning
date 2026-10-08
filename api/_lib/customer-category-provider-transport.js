'use strict';
const https=require('node:https');
const dns=require('node:dns');
const {BlockList,isIP}=require('node:net');
const MAX_RESPONSE_BYTES=16384,MAX_REQUEST_BYTES=64000,MAX_CONCURRENT_REQUESTS=8;
const blocked=new BlockList(),globalV6=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(address,prefix,'ipv4');
globalV6.addSubnet('2000::',3,'ipv6');
for(const [address,prefix] of [['2001::',32],['2001:db8::',32],['2002::',16],['3fff::',20]])blocked.addSubnet(address,prefix,'ipv6');
function publicAddress(address){
 const family=isIP(address);
 return family===4?!blocked.check(address,'ipv4'):family===6&&globalV6.check(address,'ipv6')&&!blocked.check(address,'ipv6');
}
function endpointUrl(value){
 try{
  if(typeof value!=='string'||value.length>512)return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.href!==value||isIP(url.hostname)||!url.hostname.includes('.')||!/^([a-z0-9]+(?:-[a-z0-9]+)*\.)+[a-z][a-z0-9-]*$/.test(url.hostname)||/\.(?:localhost|local|internal)$/.test(url.hostname))return null;
  return url;
 }catch(_error){return null;}
}
// DNS resolution and connection use the SAME checked addresses. No redirects,
// retries, cookies, shared agents, custom TLS trust or unbounded response reads.
function createCategoryTransport({lookup=dns.lookup,request=https.request}={}){
 let active=0;
 return function post({endpoint,body,authorization,signal,timeoutMs=150}){
  return new Promise((resolve,reject)=>{
   const url=endpointUrl(endpoint),size=typeof body==='string'?Buffer.byteLength(body):0;
   if(!url||!size||size>MAX_REQUEST_BYTES||typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._~+\/-]{1,4096}=*$/.test(authorization)||!(signal instanceof AbortSignal)||signal.aborted||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>250)return reject(new Error('category_transport_rejected'));
   if(active>=MAX_CONCURRENT_REQUESTS)return reject(new Error('category_transport_capacity'));
   active++;
   let req,timer,settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;active--;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(new Error('category_transport_failed')):resolve(value);};
   const abort=()=>{finish(new Error('aborted'));req?.destroy();};
   const checkedLookup=(hostname,options,callback)=>{
    lookup(hostname,{all:true,verbatim:true},(error,addresses)=>{
     if(error||!Array.isArray(addresses)||!addresses.length||addresses.some(row=>!publicAddress(row.address)))return callback(new Error('category_address_rejected'));
     const first=addresses[0];callback(null,options?.all?[{address:first.address,family:isIP(first.address)}]:first.address,isIP(first.address));
    });
   };
   signal.addEventListener('abort',abort,{once:true});
   timer=setTimeout(abort,timeoutMs);
   try{
    req=request(url,{method:'POST',agent:false,lookup:checkedLookup,rejectUnauthorized:true,headers:{'content-type':'application/json','accept':'application/json','content-length':size,authorization}},res=>{
     if(res.statusCode!==200||!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type']||'')||(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity')){finish(new Error('invalid_response'));res.destroy();return;}
     const chunks=[];let bytes=0;
     res.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_RESPONSE_BYTES){finish(new Error('oversized_response'));res.destroy();return;}chunks.push(chunk);});
     res.on('error',error=>finish(error));res.on('aborted',()=>finish(new Error('response_aborted')));
     res.on('end',()=>{try{finish(null,new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch(error){finish(error);}});
    });
    req.on('error',error=>finish(error));req.end(body);
   }catch(error){finish(error);req?.destroy();}
  });
 };
}
module.exports={MAX_RESPONSE_BYTES,MAX_REQUEST_BYTES,MAX_CONCURRENT_REQUESTS,publicAddress,endpointUrl,createCategoryTransport};
