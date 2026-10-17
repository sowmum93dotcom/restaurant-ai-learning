'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const projection=require('../api/_lib/selling-product-projection'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const environment={VERCEL_ENV:'preview',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'fixture',VERCEL_GIT_COMMIT_REF:'fixture',DEMEOS_SELLING_TEST_DATABASE_HOST:'fixture.invalid',POSTGRES_URL:'postgres://user:fixture@fixture.invalid/fixture'};
test('optional projection preserves JSONB, revisions, audit and ownership through backfill/update/delete/rollback',async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=createPersistenceRepository(db);
 try{
  await repo.createBusinessForOwner('owner',{businessId:'shop',products:[{businessId:'shop',productId:'p1',name:'Original',audit:[{action:'created'}]}]});
  const original=(await repo.getKnownBusiness('shop')).businessProfile,revision=catalogueRevision(original);
  await assert.rejects(projection.installProjection(db,{VERCEL_ENV:'production'}));
  await projection.installProjection(db,environment);await projection.backfillBusiness(db,'shop',environment);
  assert.equal(catalogueRevision((await repo.getKnownBusiness('shop')).businessProfile),revision);
  assert.deepEqual(await projection.readProduct(db,'owner','shop','p1'),original.products[0]);
  assert.equal(await projection.readProduct(db,'foreign','shop','p1'),null);
  await repo.saveBusiness({...original,products:[{...original.products[0],name:'Updated'}]});
  const updated=await projection.readProduct(db,'owner','shop','p1');assert.equal(updated.name,'Updated');assert.deepEqual(updated.audit,original.products[0].audit);
  await repo.saveBusiness({...original,products:[]});assert.equal(await projection.readProduct(db,'owner','shop','p1'),null);
  await projection.rollbackProjection(db,environment);assert.deepEqual((await repo.getKnownBusiness('shop')).businessProfile.products,[]);
 }finally{await client.close();}
});
module.exports={environment};
test('product-level persistence uses product CAS/audit without profile rewrites or a sync trigger',async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=createPersistenceRepository(db);
 try{
  const original={businessId:'records-shop',name:'Records',products:[{businessId:'records-shop',productId:'p1',name:'Original',variants:[{variantId:'v1',sku:'SKU-1'}],mediaGallery:{assetIds:['m1'],mainAssetId:'m1'},stockHistory:[{reason:'Initial'}]}]};
  await repo.createBusinessForOwner('owner',original);const before=(await repo.getKnownBusiness('records-shop')).businessProfile;
  assert.throws(()=>projection.createProductPersistence(db,{VERCEL_ENV:'production'}));
  const store=projection.createProductPersistence(db,environment);await store.install();assert.equal(await store.backfill('foreign','records-shop'),false);assert.equal(await store.backfill('owner','records-shop'),true);
  const initial=await store.read('owner','records-shop','p1');assert.equal(initial.revision,'1');assert.deepEqual(initial.product,before.products[0]);assert.equal(await store.read('foreign','records-shop','p1'),null);
  const next={...initial.product,name:'Product-level edit'};
  assert.equal((await store.write('owner','records-shop','p1','1',next)).revision,'2');assert.equal(await store.write('owner','records-shop','p1','1',next),null);assert.equal(await store.write('foreign','records-shop','p1','2',next),null);
  assert.deepEqual((await repo.getKnownBusiness('records-shop')).businessProfile,before,'Legacy source is preserved for compatibility/rollback');
  const changed=await store.read('owner','records-shop','p1');assert.deepEqual(changed.product.variants,initial.product.variants);assert.deepEqual(changed.product.mediaGallery,initial.product.mediaGallery);assert.deepEqual(changed.product.stockHistory,initial.product.stockHistory);
  const fresh={businessId:'records-shop',productId:'p2',name:'Created in staged store'};
  assert.equal((await store.write('owner','records-shop','p2','0',fresh)).revision,'1');
  assert.equal((await store.write('owner','records-shop','p1','2',null)).revision,'3');assert.equal(await store.read('owner','records-shop','p1'),null);
  assert.equal((await client.query('SELECT count(*)::integer n FROM demeos_selling_product_audit')).rows[0].n,3);
  await assert.rejects(store.backfill('owner','records-shop'));
  await repo.saveBusiness({...before,name:'Concurrent legacy profile update'});
  assert.equal(await store.read('owner','records-shop','p2'),null,'Stale staged store cannot override a newer legacy source');assert.equal(await store.write('owner','records-shop','p2','1',fresh),null);
 }finally{await client.close();}
});
