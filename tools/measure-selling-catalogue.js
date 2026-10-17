'use strict';
// Isolated in-memory Postgres only. Never opens a hosting/database connection.
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {parse}=require('../api/_lib/selling-catalogue');
(async()=>{const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db));try{
 const results=[];for(const size of [5,500,5000]){
 const businessId='measure-'+size,profile={businessId,name:'Controlled benchmark',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:Array.from({length:size},(_,i)=>({businessId,productId:'p-'+String(i).padStart(5,'0'),name:'Product '+i,sku:'SKU-'+i,description:'Controlled catalogue benchmark',priceMode:'fixed',price:String(i),availability:'contact'}))};
 await repo.createBusinessForOwner('benchmark-owner',profile);const stored=(await repo.getKnownBusiness(businessId)).businessProfile;
 for(const [operation,query] of [['page',parse({sort:'name'})],['search',parse({q:'SKU-'+(size-1)})]]){
 const times=[];let page;for(let i=0;i<9;i++){const start=performance.now();page=await repo.getSellingCataloguePage({identity:'benchmark-owner',businessId,profile:stored,query,stock:{}});const ms=performance.now()-start;if(i>0)times.push(ms);}
 times.sort((a,b)=>a-b);results.push({products:size,operation,medianMs:Number(((times[3]+times[4])/2).toFixed(2)),p95Ms:Number(times.at(-1).toFixed(2)),returnedProducts:page.products.length,pageBytes:Buffer.byteLength(JSON.stringify(page))});
 }
 }console.log(JSON.stringify({runtime:process.version,database:'PGlite '+require('../package.json').devDependencies['@electric-sql/pglite'],method:'one warm-up, eight measured reads per operation; isolated process; SQL page only, excludes auth, profile hydration, private media signing and network',results},null,2));
 }finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
