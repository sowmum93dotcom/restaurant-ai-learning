'use strict';
// Opt-in migration preparation. NOT called by ensureSchema or any live route.
// JSONB remains authoritative; this derived projection cannot author products.
const {isolatedTestEnvironment}=require('./selling-access');
const statements=[
 `CREATE TABLE IF NOT EXISTS demeos_selling_product_projection (
   business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id) ON DELETE CASCADE,
   product_id TEXT NOT NULL, product JSONB NOT NULL,
   PRIMARY KEY(business_id,product_id)
 )`,
 `CREATE INDEX IF NOT EXISTS demeos_selling_projection_name ON demeos_selling_product_projection(business_id,lower(product->>'name'),product_id)`,
 `CREATE INDEX IF NOT EXISTS demeos_selling_projection_sku ON demeos_selling_product_projection(business_id,(product->>'sku'),product_id)`,
 `CREATE OR REPLACE FUNCTION demeos_refresh_selling_projection() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
   INSERT INTO demeos_selling_product_projection(business_id,product_id,product)
   SELECT NEW.business_id,p->>'productId',p FROM jsonb_array_elements(COALESCE(NEW.profile->'products','[]'::jsonb)) p
   WHERE p->>'productId' IS NOT NULL AND p->>'businessId'=NEW.business_id
   ON CONFLICT(business_id,product_id) DO UPDATE SET product=EXCLUDED.product
   WHERE demeos_selling_product_projection.product IS DISTINCT FROM EXCLUDED.product;
   DELETE FROM demeos_selling_product_projection t WHERE t.business_id=NEW.business_id AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.profile->'products','[]'::jsonb)) p WHERE p->>'productId'=t.product_id AND p->>'businessId'=NEW.business_id);
   RETURN NEW;
 END $$`,
 `DROP TRIGGER IF EXISTS demeos_selling_projection_sync ON demeos_businesses`,
 `CREATE TRIGGER demeos_selling_projection_sync AFTER INSERT OR UPDATE OF profile ON demeos_businesses
   FOR EACH ROW EXECUTE FUNCTION demeos_refresh_selling_projection()`
];
async function installProjection(database,environment){
 if(!isolatedTestEnvironment(environment))throw Error('Projection migration requires the isolated Preview test database.');
 await database.transaction(async tx=>{for(const sql of statements)await tx.query(sql);});
}
async function backfillBusiness(database,businessId,environment){
 if(!isolatedTestEnvironment(environment))throw Error('Projection backfill requires the isolated Preview test database.');
 // Locks one authoritative business; concurrent writes then run the same trigger.
 // No profile rewrite, authoring revision or audit modification during backfill.
 return database.transaction(async tx=>{
  await tx.query('SELECT business_id FROM demeos_businesses WHERE business_id=$1 FOR UPDATE',[businessId]);
  return tx.query(`INSERT INTO demeos_selling_product_projection(business_id,product_id,product)
   SELECT b.business_id,p->>'productId',p FROM demeos_businesses b,
    jsonb_array_elements(COALESCE(b.profile->'products','[]'::jsonb)) p
   WHERE b.business_id=$1 AND p->>'businessId'=b.business_id AND p->>'productId' IS NOT NULL
   ON CONFLICT(business_id,product_id) DO UPDATE SET product=EXCLUDED.product`,[businessId]);
 });
}
async function readProduct(database,identity,businessId,productId){
 return (await database.query(`SELECT p.product FROM demeos_selling_product_projection p
   WHERE p.business_id=$1 AND p.product_id=$3 AND EXISTS(SELECT 1 FROM demeos_business_owners o
    WHERE o.business_id=p.business_id AND o.trusted_identity_id=$2)`,[businessId,identity,productId])).rows[0]?.product||null;
}
async function rollbackProjection(database,environment){
 if(!isolatedTestEnvironment(environment))throw Error('Projection rollback requires the isolated Preview test database.');
 await database.transaction(async tx=>{
  await tx.query('DROP TRIGGER IF EXISTS demeos_selling_projection_sync ON demeos_businesses');
  await tx.query('DROP FUNCTION IF EXISTS demeos_refresh_selling_projection()');
  await tx.query('DROP TABLE IF EXISTS demeos_selling_product_projection');
 });
}
module.exports={installProjection,backfillBusiness,readProduct,rollbackProjection};
