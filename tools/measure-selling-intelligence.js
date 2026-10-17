'use strict';
// Controlled, isolated Postgres only; no Neon connection or credentials.
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const native=require('../api/_lib/selling-native-intelligence'),service=require('../api/_lib/selling-intelligence-service'),registry=require('../api/_lib/marketing-agent-categories');
const {catalogueRevision}=require('../api/_lib/vendor-inventory'),catalogue=require('../api/_lib/selling-catalogue');
(async()=>{const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db)),results=[],cpu=process.cpuUsage(),rss=process.memoryUsage().rss;try{
 for(const size of [5,500,5000]){
 const businessId='measure-native-'+size,profile={businessId,name:'Controlled benchmark',applicationAccess:{selling:true},products:Array.from({length:size},(_,i)=>({businessId,productId:'p'+i,name:registry.getCategory('11').categoryName,description:'Controlled camera fixture',sku:'SKU-'+i,classification:{categoryId:'11',sectorId:'1',datasetVersion:registry.DATASET_VERSION},priceMode:'fixed',price:'10',availability:'contact'}))};
 await repo.createBusinessForOwner('benchmark',profile);
 const saved=(await repo.getKnownBusiness(businessId)).businessProfile,p=saved.products[0],input={profile:saved,product:p,assets:[],stock:{revision:0,entries:{},history:[]},environment:{VERCEL_ENV:'production'},identity:'benchmark'};
 for(const [operation,fn] of [['classification',()=>native.classify(p)],['analysis',()=>native.analyze(input)],['catalogue-sql-page',()=>repo.getSellingCataloguePage({identity:'benchmark',businessId,profile:saved,query:catalogue.parse(),stock:{}})],['analysis-service',()=>service.run({store:repo,profile:saved,identity:'benchmark',environment:input.environment,body:{action:'analyze-product',productId:p.productId,productRevision:catalogueRevision(p)}})]]){
 const times=[];let value,hits=0;for(let i=0;i<9;i++){const start=performance.now();value=await fn();const ms=performance.now()-start;if(i){times.push(ms);if(value.cacheHit)hits++;}}
 times.sort((a,b)=>a-b);results.push({products:size,operation,medianMs:Number(((times[3]+times[4])/2).toFixed(3)),maxMs:Number(times.at(-1).toFixed(3)),payloadBytes:Buffer.byteLength(JSON.stringify(value)),measuredCalls:8,cacheHits:hits});
 }
 }
 const used=process.cpuUsage(cpu);console.log(JSON.stringify({runtime:process.version,database:'PGlite '+require('../package.json').devDependencies['@electric-sql/pglite'],method:'one warm-up, eight measured calls; isolated process. Service includes metadata reads, hashing and cache retrieval, excludes HTTP/Clerk/network/initial profile hydration. Analysis includes classification, completeness, duplicates and metadata checks. CPU/RSS describe the whole benchmark process including database startup, not per-request resource usage.',resourceUsage:{processCpuUserMs:used.user/1000,processCpuSystemMs:used.system/1000,rssDeltaBytes:process.memoryUsage().rss-rss,finalRssBytes:process.memoryUsage().rss},results},null,2));
 }finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
