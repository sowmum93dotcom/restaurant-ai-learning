'use strict';
// Real image decoding/optimization for the existing private storage lifecycle.
const {createHash}=require('node:crypto');
const {MAX_IMAGE_BYTES}=require('./media-asset-contract');
function createSharpMediaDrivers({fetchImpl=globalThis.fetch,sharpImpl,storage}={}){
 const images=new WeakMap();
 async function read(url,options={}){
  const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Image storage request failed.');return response;
 }
 return {
  async inspectImage(asset,context){
   if(asset.kind!=='image'||!/^https:\/\//.test(context.sourceUrl||''))throw Error('A private image source is required.');
   const response=await read(context.sourceUrl),chunks=[];let size=0;
   for await(const chunk of response.body){size+=chunk.length;if(size>MAX_IMAGE_BYTES)throw Error('Image exceeds 15 MB.');chunks.push(Buffer.from(chunk));}
   if(size!==asset.sizeBytes)throw Error('Image size changed after upload verification.');
   const bytes=Buffer.concat(chunks),sharp=sharpImpl||require('sharp');
   const metadata=await sharp(bytes,{limitInputPixels:40000000,failOn:'warning'}).metadata();
   const types={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
   if(types[metadata.format]!==asset.contentType||!metadata.width||!metadata.height||(metadata.pages||1)>1)throw Error('Use a valid, non-animated JPEG, PNG or WebP image.');
   images.set(asset,{bytes,sharp});
   return {width:metadata.width,height:metadata.height,contentType:asset.contentType,sourceHash:createHash('sha256').update(bytes).digest('hex')};
  },
  async optimizeImage(asset,inspected,context){
   const image=images.get(asset);images.delete(asset);
   if(!image||!storage||!context.outputDestinations?.length)throw Error('Image output storage is unavailable.');
   const results=[];
   for(const destination of context.outputDestinations){
    const widths={master:1600,thumbnail:360,customer:1000,marketing:1200};
    if(!widths[destination.role]||destination.contentType!=='image/webp')throw Error('Invalid image output.');
    const {data,info}=await image.sharp(image.bytes,{limitInputPixels:40000000,failOn:'warning'}).rotate().resize({width:widths[destination.role],height:widths[destination.role],fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
    await read(destination.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/webp',...destination.headers},body:data});
    const delivery=await storage.createDeliveryRead({storageKey:destination.storageKey,expiresAt:new Date(Date.now()+10*60*1000).toISOString()});
    if(!delivery?.deliveryUrl)throw Error('Private image delivery is unavailable.');
    results.push({role:destination.role,storageKey:destination.storageKey,deliveryUrl:delivery.deliveryUrl,contentType:'image/webp',width:info.width,height:info.height,processedHash:createHash('sha256').update(data).digest('hex'),processedSizeBytes:data.length});
   }
   const master=results.find(r=>r.role==='master');
   return {...master,derivatives:results.filter(r=>r.role!=='master')};
  }
 };
}
module.exports={createSharpMediaDrivers};
