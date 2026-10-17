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
