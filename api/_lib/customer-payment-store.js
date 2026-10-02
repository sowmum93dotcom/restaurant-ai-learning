// Lazy, isolated test-mode storage. Not invoked by the current production checkout.
'use strict';
const TABLE='demeos_customer_test_payment_attempts';
const SCHEMA=`CREATE TABLE IF NOT EXISTS ${TABLE} (
 order_id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, provider TEXT NOT NULL,
 idempotency_key TEXT NOT NULL, record JSONB NOT NULL,
 version INTEGER NOT NULL DEFAULT 0, processed_events JSONB NOT NULL DEFAULT '[]',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (customer_id,idempotency_key),
 CHECK (record @> '{"quote":{"mode":"test","recipient":"business"}}'::jsonb),
 CHECK (record->'quote'->>'customerId' = customer_id),
 CHECK (jsonb_typeof(processed_events) = 'array')
)`;
function createPaymentStore(database){
 let schema;
 async function ready(){if(!schema)schema=database.query(SCHEMA).catch(error=>{schema=null;throw error;});return schema;}
 const row=result=>result.rows?.[0]?.record||null;
 return Object.freeze({
  async reserve(record,key){await ready();return row(await database.query(`INSERT INTO ${TABLE} (order_id,customer_id,provider,idempotency_key,record)
   VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (customer_id,idempotency_key) DO UPDATE SET customer_id=EXCLUDED.customer_id RETURNING record`,[record.id,record.quote.customerId,record.provider,key,JSON.stringify(record)]));},
  async attach(record,session){await ready();const next={...record,...session,version:record.version+1};return row(await database.query(`WITH changed AS (
   UPDATE ${TABLE} SET record=$3::jsonb, version=version+1, updated_at=NOW()
   WHERE order_id=$1 AND version=$2 AND record->>'state'='creating' RETURNING record
  ) SELECT record FROM changed UNION ALL SELECT record FROM ${TABLE}
   WHERE order_id=$1 AND record->>'paymentId'=$4 AND NOT EXISTS (SELECT 1 FROM changed) LIMIT 1`,[record.id,record.version,JSON.stringify(next),session.paymentId]));},
  async get(id){await ready();return row(await database.query(`SELECT record FROM ${TABLE} WHERE order_id=$1`,[id]));},
  async getOwn(customerId,id){await ready();return row(await database.query(`SELECT record FROM ${TABLE} WHERE order_id=$1 AND customer_id=$2`,[id,customerId]));},
  async listOwn(customerId){await ready();return (await database.query(`SELECT record FROM ${TABLE} WHERE customer_id=$1 ORDER BY created_at DESC, order_id DESC LIMIT 50`,[customerId])).rows.map(row=>row.record);},
  async apply(record,next,eventId){await ready();return row(await database.query(`WITH changed AS (
   UPDATE ${TABLE} SET record=$3::jsonb, version=version+1, processed_events=processed_events||$4::jsonb, updated_at=NOW()
   WHERE order_id=$1 AND version=$2 AND NOT processed_events @> $4::jsonb RETURNING record
  ) SELECT record FROM changed UNION ALL SELECT record FROM ${TABLE}
   WHERE order_id=$1 AND processed_events @> $4::jsonb AND NOT EXISTS (SELECT 1 FROM changed) LIMIT 1`,[record.id,record.version,JSON.stringify({...next,version:record.version+1}),JSON.stringify([eventId])]));}
 });
}
module.exports={createPaymentStore,SCHEMA};
