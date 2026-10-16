'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createMediaStorageAdapter}=require('../../api/_lib/media-storage-adapter');
const {createSharpMediaDrivers}=require('../../api/_lib/media-sharp-driver');
async function diskStorage({blobProtocol=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-media-')),types=new Map();
 const file=key=>path.join(root,Buffer.from(key).toString('base64url'));
 const url=key=>'https://storage.gate/'+encodeURIComponent(key);
 async function fetchImpl(address,options={}){
  const key=decodeURIComponent(new URL(address).pathname.slice(1));
  if(options.method==='PUT'){if(blobProtocol&&(!options.headers?.['x-content-type']||options.headers?.['x-vercel-blob-access']!=='private'))return new Response('',{status:400});const bytes=Buffer.from(options.body);await fs.writeFile(file(key),bytes);types.set(key,blobProtocol?options.headers['x-content-type']:options.headers['Content-Type']);return new Response('',{status:200});}
  try{return new Response(await fs.readFile(file(key)),{status:200,headers:{'Content-Type':types.get(key)}});}catch{return new Response('',{status:404});}
 }
 const driver={
  async createUpload({storageKey,contentType}){return {storageKey,uploadUrl:url(storageKey),...(blobProtocol?{headers:{'x-content-type':contentType,'x-vercel-blob-access':'private'}}:{})};},
  async verifyUpload({storageKey}){try{const stat=await fs.stat(file(storageKey));return {exists:true,storageKey,sizeBytes:stat.size,contentType:types.get(storageKey)};}catch{return null;}},
  async createProcessingRead({storageKey,expiresAt}){return {storageKey,expiresAt,readUrl:url(storageKey)};},
  async createProcessingWrite({storageKey,contentType}){return {storageKey,contentType,uploadUrl:url(storageKey),...(blobProtocol?{headers:{'x-content-type':contentType,'x-vercel-blob-access':'private'}}:{})};},
  async createDeliveryRead({storageKey,expiresAt}){return {storageKey,expiresAt,deliveryUrl:url(storageKey)};}
 };
 const adapter=createMediaStorageAdapter(driver);
 return {root,file,fetchImpl,driver,adapter,drivers:createSharpMediaDrivers({fetchImpl,storage:adapter})};
}
module.exports={diskStorage};
