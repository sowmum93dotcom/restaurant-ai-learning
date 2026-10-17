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

// Successor experiment: product-level CAS and immutable audit, no sync trigger
// and no full-profile write. Kept off all live routes until a complete cutover.
function createProductPersistence(database,environment){
 if(!isolatedTestEnvironment(environment))throw Error('Product persistence experiment requires isolated Preview.');
 const hash=require('./selling-native-intelligence').hash;
 return {
  async install(){
   await database.transaction(async tx=>{
    await tx.query(`CREATE TABLE IF NOT EXISTS demeos_selling_product_state(business_id TEXT PRIMARY KEY REFERENCES demeos_businesses(business_id),source_stamp TIMESTAMPTZ NOT NULL)`);
    await tx.query(`CREATE TABLE IF NOT EXISTS demeos_selling_product_records(business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),product_id TEXT NOT NULL,product JSONB NOT NULL,revision BIGINT NOT NULL DEFAULT 1,content_hash TEXT NOT NULL,deleted BOOLEAN NOT NULL DEFAULT FALSE,PRIMARY KEY(business_id,product_id))`);
    await tx.query(`CREATE INDEX IF NOT EXISTS demeos_selling_product_name ON demeos_selling_product_records(business_id,lower(product->>'name'),product_id) WHERE NOT deleted`);
    await tx.query(`CREATE TABLE IF NOT EXISTS demeos_selling_product_audit(business_id TEXT NOT NULL,product_id TEXT NOT NULL,revision BIGINT NOT NULL,actor TEXT NOT NULL,previous_product JSONB,next_product JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(business_id,product_id,revision))`);
   });
  },
  async backfill(identity,businessId){
   return database.transaction(async tx=>{
    const row=(await tx.query(`SELECT b.profile FROM demeos_businesses b WHERE b.business_id=$1 AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2) FOR UPDATE`,[businessId,identity])).rows[0];
    if(!row)return false;
    const exists=(await tx.query('SELECT 1 FROM demeos_selling_product_state WHERE business_id=$1',[businessId])).rows[0];if(exists)throw Error('Already staged: never overwrite product-level edits with a repeat backfill.');
    const products=row.profile.products||[];
    if(products.length>10000||new Set(products.map(p=>p.productId)).size!==products.length||products.some(p=>p.businessId!==businessId||typeof p.productId!=='string'))throw Error('Invalid legacy product scope.');
    await tx.query(`INSERT INTO demeos_selling_product_records(business_id,product_id,product,content_hash)
     SELECT $1,x.product_id,x.product,x.content_hash FROM jsonb_to_recordset($2::jsonb) AS x(product_id TEXT,product JSONB,content_hash TEXT)`,[businessId,JSON.stringify(products.map(p=>({product_id:p.productId,product:p,content_hash:hash(p)})))]);
    await tx.query(`INSERT INTO demeos_selling_product_state SELECT business_id,updated_at FROM demeos_businesses WHERE business_id=$1`,[businessId]);return true;
   });
  },
  async read(identity,businessId,productId){
   return (await database.query(`SELECT p.product,p.revision::text,p.content_hash FROM demeos_selling_product_records p
    JOIN demeos_selling_product_state s USING(business_id) JOIN demeos_businesses b USING(business_id)
    WHERE p.business_id=$1 AND p.product_id=$3 AND NOT p.deleted AND b.updated_at=s.source_stamp
    AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2)`,[businessId,identity,productId])).rows[0]||null;
  },
  async write(identity,businessId,productId,expectedRevision,nextProduct){
   if(!/^[a-zA-Z0-9_-]{1,120}$/.test(productId)||!/^\d{1,12}$/.test(String(expectedRevision))||nextProduct!==null&&(!nextProduct||nextProduct.businessId!==businessId||nextProduct.productId!==productId||Buffer.byteLength(JSON.stringify(nextProduct))>65536))throw Error('Invalid product write scope.');
   return database.transaction(async tx=>{
    // SHARE blocks legacy writes/backfill races, but permits independent product
    // transactions to proceed together. Parent stamp check is O(1), no JSON scan.
    const owned=(await tx.query(`SELECT b.business_id FROM demeos_businesses b JOIN demeos_selling_product_state s USING(business_id)
      WHERE b.business_id=$1 AND b.updated_at=s.source_stamp AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2) FOR SHARE OF b`,[businessId,identity])).rows[0];
    if(!owned)return null;
    const previous=(await tx.query(`SELECT product,revision::text FROM demeos_selling_product_records WHERE business_id=$1 AND product_id=$2 FOR UPDATE`,[businessId,productId])).rows[0];
    if(previous?previous.revision!==String(expectedRevision):String(expectedRevision)!=='0'||nextProduct===null)return null;
    // Callers must reuse the established product/variant/media/stock validation
    // service before this persistence primitive. It grants no publication rights.
    const revision=Number(expectedRevision)+1,value=nextProduct||previous.product;
    const changed=await tx.query(`INSERT INTO demeos_selling_product_records(business_id,product_id,product,revision,content_hash,deleted)
      VALUES($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT(business_id,product_id) DO UPDATE SET product=EXCLUDED.product,revision=EXCLUDED.revision,content_hash=EXCLUDED.content_hash,deleted=EXCLUDED.deleted WHERE demeos_selling_product_records.revision=$7 RETURNING revision::text`,[businessId,productId,JSON.stringify(value),revision,hash(value),nextProduct===null,Number(expectedRevision)]);
    if(!changed.rows[0])return null;
    await tx.query(`INSERT INTO demeos_selling_product_audit(business_id,product_id,revision,actor,previous_product,next_product) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,[businessId,productId,revision,identity,JSON.stringify(previous?.product||null),JSON.stringify(nextProduct)]);
    return changed.rows[0];
   });
  }
 };
}
module.exports.createProductPersistence=createProductPersistence;
