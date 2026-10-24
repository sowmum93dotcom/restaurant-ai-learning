'use strict';
const {CONTRACT,LIMITS,validateInput,validateOutput,requestId,digest,principalKey}=require('./root-text-contract');
const {workspace:personalWorkspace}=require('./root-personal-workspace');
// Explicit additive migration for the isolated Preview only. No Selling budget,
// business identifier, automatic expiry or global schema mutation is used.
const SCHEMA=[
 `CREATE TABLE IF NOT EXISTS demeos_root_native_budgets(owner_key TEXT PRIMARY KEY,active_request UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
 `CREATE TABLE IF NOT EXISTS demeos_root_native_jobs(owner_key TEXT NOT NULL REFERENCES demeos_root_native_budgets(owner_key),request_id UUID NOT NULL,workspace_id TEXT NOT NULL REFERENCES demeos_root_workspaces(workspace_id),input_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('claimed','succeeded','failed','uncertain')),result JSONB,executions INTEGER NOT NULL DEFAULT 0 CHECK(executions BETWEEN 0 AND 1),code TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(owner_key,request_id))`
];
function createLedger(database,{identity,workspace}){
 const expected=personalWorkspace(identity,workspace?.audience);
 const valid=typeof identity==='string'&&identity.length>0&&identity.length<=512&&['business','customer'].includes(workspace?.audience)&&workspace.workspaceId===expected.workspaceId;
 const ownerKey=valid?principalKey(identity):null;
 return {
  async claim({input,inputHash}){
   if(!valid||!validateInput(input)||!digest(inputHash)||input.workspaceId!==workspace.workspaceId||input.audience!==workspace.audience)return {status:'denied'};
   return database.transaction(async client=>{
    await client.query('INSERT INTO demeos_root_workspaces(workspace_id,owner_identity_id,audience) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[workspace.workspaceId,identity,workspace.audience]);
    const owner=await client.query('SELECT workspace_id FROM demeos_root_workspaces WHERE workspace_id=$1 AND owner_identity_id=$2 AND audience=$3 FOR UPDATE',[workspace.workspaceId,identity,workspace.audience]);
    if(owner.rows.length!==1)return {status:'denied'};
    await client.query('INSERT INTO demeos_root_native_budgets(owner_key) VALUES($1) ON CONFLICT DO NOTHING',[ownerKey]);
    const budget=await client.query('SELECT active_request FROM demeos_root_native_budgets WHERE owner_key=$1 FOR UPDATE',[ownerKey]);
    const existing=await client.query('SELECT workspace_id,input_hash,state,result FROM demeos_root_native_jobs WHERE owner_key=$1 AND request_id=$2',[ownerKey,input.requestId]);
    const prior=existing.rows[0];
    if(prior){
     if(prior.workspace_id!==workspace.workspaceId||prior.input_hash!==inputHash)return {status:'conflict'};
     return prior.state==='succeeded'?{status:'cached',result:prior.result}:{status:'limited'};
    }
    if(budget.rows[0].active_request)return {status:'limited'};
    const count=await client.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '1 hour')::int AS recent FROM demeos_root_native_jobs WHERE owner_key=$1",[ownerKey]);
    if(count.rows[0].total>=LIMITS.maxTotalJobs||count.rows[0].recent>=LIMITS.maxJobsPerHour)return {status:'limited'};
    await client.query("INSERT INTO demeos_root_native_jobs(owner_key,request_id,workspace_id,input_hash,state) VALUES($1,$2,$3,$4,'claimed')",[ownerKey,input.requestId,workspace.workspaceId,inputHash]);
    await client.query('UPDATE demeos_root_native_budgets SET active_request=$2 WHERE owner_key=$1',[ownerKey,input.requestId]);
    return {status:'claimed',claimId:input.requestId};
   });
  },
  async finish({claimId,inputHash,result,uncertain=false,executions=0,code='native-runtime-failed'}){
   if(result&&(uncertain||executions!==1||code!=='reply-requires-review'||result.status!=='succeeded'||!validateOutput(result.output)||result.provenance?.workspaceId!==workspace.workspaceId||result.provenance?.audience!==workspace.audience||result.provenance?.inputHash!==inputHash))return {status:'invalid'};
   if(!valid||!requestId(claimId)||!digest(inputHash)||![0,1].includes(executions)||!['native-runtime-failed','execution-timeout','invalid-model-output','scope-revoked','deadline-exceeded','reply-requires-review'].includes(code))return {status:'invalid'};
   return database.transaction(async client=>{
    await client.query('SELECT owner_key FROM demeos_root_native_budgets WHERE owner_key=$1 FOR UPDATE',[ownerKey]);
    const state=result?'succeeded':uncertain?'uncertain':'failed';
    const changed=await client.query("UPDATE demeos_root_native_jobs SET state=$5,result=$6::jsonb,executions=$7,code=$8,updated_at=NOW() WHERE owner_key=$1 AND request_id=$2 AND workspace_id=$3 AND input_hash=$4 AND state='claimed' RETURNING request_id",[ownerKey,claimId,workspace.workspaceId,inputHash,state,result?JSON.stringify(result):null,executions,code]);
    if(changed.rows.length!==1)return {status:'unchanged'};
    // A lost/aborted HTTP response does not prove GPU termination. Preserve the
    // claim and its consumed job count until a verified operator reconciliation.
    if(!uncertain)await client.query('UPDATE demeos_root_native_budgets SET active_request=NULL WHERE owner_key=$1 AND active_request=$2',[ownerKey,claimId]);
    return {status:state};
   });
  }
 };
}
module.exports={SCHEMA,createLedger,CONTRACT};
