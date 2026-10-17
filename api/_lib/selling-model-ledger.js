'use strict';
const {randomUUID}=require('node:crypto');
// Durable budget, single active execution per business and last-result reuse.
// Runtime composition only: no public API and no model/runtime is installed.
function createModelLedger(database){
 return {
  async claim({identity,input,inputHash,limits}){
   await database.ensureSchema();
   const values=[input.businessId,identity,inputHash,randomUUID(),limits.maxJobsPerHour];
   const cached=await database.query(`SELECT s.result FROM demeos_visual_execution_slots s
     WHERE s.business_id=$1 AND s.input_hash=$3 AND NOT s.active AND s.updated_at>NOW()-INTERVAL '1 hour'
     AND s.result->>'status'='succeeded'
     AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2)`,values.slice(0,3));
   if(cached.rows[0]?.result)return {status:'cached',result:cached.rows[0].result};
   const result=await database.query(`INSERT INTO demeos_visual_execution_slots(business_id,claim_id,input_hash)
     SELECT $1,$4,$3 WHERE EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=$1 AND o.trusted_identity_id=$2)
     ON CONFLICT(business_id) DO UPDATE SET claim_id=EXCLUDED.claim_id,input_hash=EXCLUDED.input_hash,active=TRUE,result=NULL,
       jobs=CASE WHEN demeos_visual_execution_slots.window_start<=NOW()-INTERVAL '1 hour' THEN 1 ELSE demeos_visual_execution_slots.jobs+1 END,
       window_start=CASE WHEN demeos_visual_execution_slots.window_start<=NOW()-INTERVAL '1 hour' THEN NOW() ELSE demeos_visual_execution_slots.window_start END,updated_at=NOW()
     WHERE NOT demeos_visual_execution_slots.active AND
       (demeos_visual_execution_slots.window_start<=NOW()-INTERVAL '1 hour' OR demeos_visual_execution_slots.jobs<$5)
     RETURNING claim_id`,values);
   return result.rows[0]?{status:'claimed',claimId:result.rows[0].claim_id}:{status:'limited'};
  },
  async finish({claimId,inputHash,result,metrics,terminal}){
   await database.ensureSchema();
   if(!result&&!terminal)return;
   // Successful result is never overwritten by the finally/terminal accounting.
   await database.query(`WITH finished AS (
     UPDATE demeos_visual_execution_slots SET active=FALSE,result=$3::jsonb,updated_at=NOW()
     WHERE claim_id=$1 AND input_hash=$2 AND active RETURNING business_id,result
    ) INSERT INTO demeos_visual_execution_events(claim_id,business_id,input_hash,result)
     SELECT $1,business_id,$2,result FROM finished ON CONFLICT DO NOTHING`,
     [claimId,inputHash,JSON.stringify(result||{status:'failed',code:'execution-did-not-produce-validated-output',resourceUsage:metrics})]);
  }
 };
}
module.exports={createModelLedger};
