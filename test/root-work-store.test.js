'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{SCHEMA,createStore}=require('../api/_lib/root-work-store');
const {workspace,analyze}=require('../api/_lib/root-intelligence');
test('ROOT persistence is additive, tenant/audience scoped, idempotent and revision-guarded with atomic audit',async()=>{
 const client=new PGlite(),database=createDatabase(client);await database.ensureSchema();
 try{
  for(const statement of SCHEMA)await database.query(statement);for(const statement of SCHEMA)await database.query(statement);
  const store=createStore(database),business=workspace('alice','business'),customer=workspace('alice','customer'),other=workspace('bob','business');
  const input={action:'understand',audience:'business',locale:'en',text:'Groceries',categoryId:'9'},result=analyze(input),requestId=randomUUID();
  const saved=await store.save('alice',business,requestId,result);assert.equal(saved.status,'saved');assert.equal(saved.work.revision,1);
  assert.equal((await store.list('alice',business)).length,1);assert.deepEqual(await store.list('bob',business),[]);assert.deepEqual(await store.list('alice',customer),[]);assert.deepEqual(await store.list('bob',other),[]);
  const replay=await store.save('alice',business,requestId,analyze(input));assert.equal(replay.work.work_id,saved.work.work_id);assert.equal(replay.reused,true);
  assert.equal((await store.save('alice',business,requestId,analyze({...input,text:'Changed'}))).status,'conflict');
  assert.equal((await store.save('bob',business,randomUUID(),result)).status,'denied');
  const workId=saved.work.work_id;
  assert.equal((await store.review('bob',business,{workId,revision:1,decision:'accepted'})).status,'denied');
  assert.equal((await store.review('alice',customer,{workId,revision:1,decision:'accepted'})).status,'denied');
  assert.equal((await store.review('alice',business,{workId,revision:2,decision:'accepted'})).status,'conflict');
  const outcomes=await Promise.all(['accepted','rejected'].map(decision=>store.review('alice',business,{workId,revision:1,decision})));assert.equal(outcomes.filter(x=>x.status==='reviewed').length,1);assert.equal(outcomes.filter(x=>x.status==='conflict').length,1);
  const corrected=await store.review('alice',business,{workId,revision:2,decision:'corrected',text:'Carrots only'});assert.equal(corrected.status,'reviewed');assert.equal(corrected.work.revision,3);assert.equal(corrected.work.reviewed_text,'Carrots only');assert.equal(corrected.work.result.source.text,'Groceries');
  assert.equal((await store.review('alice',business,{workId,revision:3,decision:'accepted',text:'cannot inject correction'})).status,'invalid');
  assert.equal((await store.review('alice',business,{workId,revision:3,decision:'corrected',text:'x'.repeat(501)})).status,'invalid');
  const audit=await database.query('SELECT * FROM demeos_root_audit WHERE workspace_id=$1 ORDER BY revision',[business.workspaceId]);assert.equal(audit.rows.length,3);assert.deepEqual(audit.rows.map(r=>r.revision),[1,2,3]);assert.ok(audit.rows.every(r=>r.actor==='alice'));
  const businessCount=await database.query('SELECT COUNT(*)::int AS count FROM demeos_businesses');assert.equal(businessCount.rows[0].count,0,'ROOT never creates a vendor record');
  await database.query(`CREATE OR REPLACE FUNCTION root_reject_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit fixture failure'; END; $$ LANGUAGE plpgsql`);await database.query(`CREATE TRIGGER root_audit_failure BEFORE INSERT ON demeos_root_audit FOR EACH ROW EXECUTE FUNCTION root_reject_audit()`);
  await assert.rejects(store.review('alice',business,{workId,revision:3,decision:'rejected'}));assert.equal((await store.list('alice',business))[0].revision,3,'failed audit must roll back the review');
 }finally{await client.close();}
});
