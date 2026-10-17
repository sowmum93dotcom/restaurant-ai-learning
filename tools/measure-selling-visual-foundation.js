'use strict';
// Reproducible isolated SQL measurements; no Neon URL, credentials or live writes.
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const projection=require('../api/_lib/selling-product-projection'),native=require('../api/_lib/selling-native-intelligence'),catalogue=require('../api/_lib/selling-catalogue'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const environment={VERCEL_ENV:'preview',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'fixture',VERCEL_GIT_COMMIT_REF:'fixture',DEMEOS_SELLING_TEST_DATABASE_HOST:'fixture.invalid',POSTGRES_URL:'postgres://fixture:fixture@fixture.invalid/fixture'};
(async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=createPersistenceRepository(db),results=[];
 const measure=async(size,operation,fn)=>{
  const times=[];let value;
  for(let i=0;i<9;i++){const started=performance.now();value=await fn();if(i)times.push(performance.now()-started);}
  times.sort((a,b)=>a-b);results.push({products:size,operation,medianMs:Number(((times[3]+times[4])/2).toFixed(3)),maxMs:Number(times.at(-1).toFixed(3)),payloadBytes:Buffer.byteLength(JSON.stringify(value??null)),calls:8});
 };
 try{
  for(const size of [50,500,5000]){
   const businessId='measure-visual-'+size,owner='benchmark',profile={businessId,name:'Controlled SQL fixture',applicationAccess:{selling:true},products:Array.from({length:size},(_,i)=>({businessId,productId:'p'+i,name:'Fixture '+i,sku:'SKU-'+i,description:'Controlled product',availability:'contact',priceMode:'contact',audit:[{action:'created'}]}))};
   await repo.createBusinessForOwner(owner,profile);
   const stored=(await repo.getKnownBusiness(businessId)).businessProfile,product=stored.products.at(-1),revision=catalogueRevision(product);
   await measure(size,'authoritative-profile-hydration',()=>repo.getKnownBusiness(businessId));
   await measure(size,'jsonb-product-lookup',async()=>(await db.query(`SELECT p FROM demeos_businesses b,jsonb_array_elements(b.profile->'products') p WHERE b.business_id=$1 AND p->>'productId'=$3 AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2)`,[businessId,owner,product.productId])).rows[0]);
   await measure(size,'jsonb-product-update-current-path',()=>repo.saveBusiness({...stored,products:stored.products.map(p=>p.productId===product.productId?{...p,description:'Controlled update'}:p)}));
   await repo.saveBusiness(stored);
   await measure(size,'catalogue-page-current-path',()=>repo.getSellingCataloguePage({identity:owner,businessId,profile:stored,query:catalogue.parse(),stock:{}}));
   await measure(size,'deterministic-duplicate-detection',()=>native.duplicates(product,stored.products,businessId));
   await measure(size,'product-revision-check',()=>catalogueRevision(product)===revision);
   await measure(size,'business-ownership-check',()=>repo.isBusinessOwnedByIdentity(owner,businessId));
   await measure(size,'analysis-result-indexed-lookup',()=>repo.getSellingIntelligence(owner,businessId,product.productId,'a'.repeat(64)));
   await projection.installProjection(db,environment);await projection.backfillBusiness(db,businessId,environment);
   await measure(size,'prepared-projection-product-lookup',()=>projection.readProduct(db,owner,businessId,product.productId));
   await measure(size,'prepared-projection-page',async()=>(await db.query(`SELECT p.product FROM demeos_selling_product_projection p WHERE p.business_id=$1 AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2) ORDER BY lower(p.product->>'name'),p.product_id LIMIT 25`,[businessId,owner])).rows);
   await measure(size,'jsonb-update-with-projection-trigger',()=>repo.saveBusiness({...stored,products:stored.products.map(p=>p.productId===product.productId?{...p,description:'Controlled projection update'}:p)}));
   await projection.rollbackProjection(db,environment);
   const records=projection.createProductPersistence(db,environment);await records.install();await records.backfill(owner,businessId);
   await measure(size,'product-record-owned-lookup',()=>records.read(owner,businessId,product.productId));
   let expected='1';
   await measure(size,'product-record-CAS-update-with-audit',async()=>{const result=await records.write(owner,businessId,product.productId,expected,{...product,description:'Controlled record update'});if(!result)throw Error('CAS failed');expected=result.revision;return result;});
   await measure(size,'product-record-indexed-page',async()=>(await db.query(`SELECT p.product,p.revision::text FROM demeos_selling_product_records p JOIN demeos_selling_product_state s USING(business_id) JOIN demeos_businesses b USING(business_id) WHERE p.business_id=$1 AND NOT p.deleted AND b.updated_at=s.source_stamp AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2) ORDER BY lower(p.product->>'name'),p.product_id LIMIT 25`,[businessId,owner])).rows);

  }
  console.log(JSON.stringify({runtime:process.version,database:'PGlite 0.5.8',method:'One warm-up/eight measured calls. Isolated embedded Postgres, no HTTP/Clerk/Neon network. Projection and product-record CAS are isolated preparation only, NOT the live catalogue path. Product-record writes include ownership, source stamp, revision lock and immutable audit. Whole-profile writes remain O(n); max is not a statistical p95. Repeated writes use the same controlled value.',results},null,2));
 }finally{await client.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
