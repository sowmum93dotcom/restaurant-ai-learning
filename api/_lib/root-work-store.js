'use strict';
const {randomUUID}=require('node:crypto');
const {hash}=require('./selling-native-intelligence');
// Separate additive migration, deliberately NOT part of the global schema manager.
// Operators may apply these statements only to the verified isolated Preview DB.
const SCHEMA=[
 `CREATE TABLE IF NOT EXISTS demeos_root_workspaces(workspace_id TEXT PRIMARY KEY, owner_identity_id TEXT NOT NULL, audience TEXT NOT NULL CHECK(audience IN ('business','customer')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(owner_identity_id,audience))`,
 `CREATE TABLE IF NOT EXISTS demeos_root_work(workspace_id TEXT NOT NULL REFERENCES demeos_root_workspaces(workspace_id), work_id UUID NOT NULL, request_id UUID NOT NULL, revision INTEGER NOT NULL DEFAULT 1, result JSONB NOT NULL, review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','accepted','corrected','rejected')), reviewed_text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(workspace_id,work_id), UNIQUE(workspace_id,request_id))`,
 `CREATE TABLE IF NOT EXISTS demeos_root_audit(workspace_id TEXT NOT NULL, work_id UUID NOT NULL, revision INTEGER NOT NULL, event_id UUID NOT NULL, action TEXT NOT NULL CHECK(action IN ('saved','accepted','corrected','rejected')), actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(workspace_id,event_id), UNIQUE(workspace_id,work_id,revision), FOREIGN KEY(workspace_id,work_id) REFERENCES demeos_root_work(workspace_id,work_id))`
];
const validId=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
function createStore(database){
 const owner=async(client,identity,workspace,lock=false)=>{
  const found=await client.query(`SELECT workspace_id FROM demeos_root_workspaces WHERE workspace_id=$1 AND owner_identity_id=$2 AND audience=$3${lock?' FOR UPDATE':''}`,[workspace.workspaceId,identity,workspace.audience]);return found.rows.length===1;
 };
 return {
  async list(identity,workspace){
   const result=await database.query(`SELECT w.work_id,w.revision,w.result,w.review_state,w.reviewed_text,w.created_at,w.updated_at FROM demeos_root_work w JOIN demeos_root_workspaces s USING(workspace_id) WHERE w.workspace_id=$1 AND s.owner_identity_id=$2 AND s.audience=$3 ORDER BY w.created_at DESC,w.work_id DESC LIMIT 50`,[workspace.workspaceId,identity,workspace.audience]);return result.rows;
  },
  async save(identity,workspace,requestId,result){
   if(!validId(requestId))return {status:'invalid'};
   return database.transaction(async client=>{
    await client.query(`INSERT INTO demeos_root_workspaces(workspace_id,owner_identity_id,audience) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[workspace.workspaceId,identity,workspace.audience]);
    if(!await owner(client,identity,workspace,true))return {status:'denied'};
    const existing=await client.query(`SELECT * FROM demeos_root_work WHERE workspace_id=$1 AND request_id=$2`,[workspace.workspaceId,requestId]);
    if(existing.rows[0]){
     const prior=existing.rows[0].result;if(hash([prior.source,prior.locale,prior.selectedCategory])!==hash([result.source,result.locale,result.selectedCategory]))return {status:'conflict'};
     return {status:'saved',work:existing.rows[0],reused:true};
    }
    const count=await client.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '1 hour')::int AS recent FROM demeos_root_work WHERE workspace_id=$1`,[workspace.workspaceId]);
    if(count.rows[0].total>=1000||count.rows[0].recent>=100)return {status:'limited'};
    const workId=randomUUID();
    const saved=await client.query(`INSERT INTO demeos_root_work(workspace_id,work_id,request_id,result) VALUES($1,$2,$3,$4::jsonb) RETURNING *`,[workspace.workspaceId,workId,requestId,JSON.stringify({...result,persistence:'saved',review:{status:'pending',requiresUserCorrection:true}})]);
    await client.query(`INSERT INTO demeos_root_audit(workspace_id,work_id,revision,event_id,action,actor) VALUES($1,$2,1,$3,'saved',$4)`,[workspace.workspaceId,workId,randomUUID(),identity]);
    return {status:'saved',work:saved.rows[0]};
   });
  },
  async review(identity,workspace,{workId,revision,decision,text}){
   if(!validId(workId)||!Number.isSafeInteger(revision)||revision<1||!['accepted','corrected','rejected'].includes(decision)||(decision==='corrected'&&(typeof text!=='string'||!text.trim()||text.length>500))||(decision!=='corrected'&&text!==undefined))return {status:'invalid'};
   return database.transaction(async client=>{
    if(!await owner(client,identity,workspace,true))return {status:'denied'};
    const row=await client.query(`SELECT * FROM demeos_root_work WHERE workspace_id=$1 AND work_id=$2 FOR UPDATE`,[workspace.workspaceId,workId]);const work=row.rows[0];if(!work)return {status:'denied'};
    if(work.revision!==revision)return {status:'conflict'};
    const updated=await client.query(`UPDATE demeos_root_work SET revision=revision+1,review_state=$3,reviewed_text=$4,updated_at=NOW() WHERE workspace_id=$1 AND work_id=$2 AND revision=$5 RETURNING *`,[workspace.workspaceId,workId,decision,decision==='corrected'?text.trim():null,revision]);
    if(!updated.rows[0])return {status:'conflict'};
    await client.query(`INSERT INTO demeos_root_audit(workspace_id,work_id,revision,event_id,action,actor) VALUES($1,$2,$3,$4,$5,$6)`,[workspace.workspaceId,workId,revision+1,randomUUID(),decision,identity]);return {status:'reviewed',work:updated.rows[0]};
   });
  }
 };
}
module.exports={SCHEMA,createStore,validId};
