'use strict';
const http=require('node:http'),{timingSafeEqual}=require('node:crypto');
const {createProcessor}=require('./processor');
function createServer({token,processor}){
 if(typeof token!=='string'||token.length<32)throw Error('PROCESSOR_TOKEN must contain at least 32 characters');
 let busy=false;
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  const send=(code,body)=>{res.statusCode=code;res.end(JSON.stringify(body));};
  if(req.method==='GET'&&req.url==='/health')return send(200,{status:'ok'});
  const credential=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(credential.length!==expected.length||!timingSafeEqual(credential,expected))return send(401,{error:'Unauthorized'});
  const operation={'/inspect/video':'inspect','/transcode/video':'transcode'}[req.url];
  if(req.method!=='POST'||!operation)return send(404,{error:'Unknown operation'});
  if(busy)return send(429,{error:'Processor busy; retry the queued upload'});
  busy=true;
  try{
   let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>65536)return send(413,{error:'Request exceeds limit'});body+=chunk;}
   const result=await processor(operation,JSON.parse(body));send(200,result);
  }catch{send(422,{error:'Video processing failed. Check format, duration, size and delegated storage access.'});}
  finally{busy=false;}
 });
}
if(require.main===module){
 const processor=createProcessor({hosts:(process.env.STORAGE_HOSTS||'').split(',').map(h=>h.trim()).filter(Boolean)});
 const server=createServer({token:process.env.PROCESSOR_TOKEN,processor});
 server.requestTimeout=15000;server.headersTimeout=10000;server.listen(Number(process.env.PORT)||10000,'0.0.0.0');
}
module.exports={createServer};
