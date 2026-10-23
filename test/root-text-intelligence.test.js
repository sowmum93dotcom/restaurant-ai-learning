'use strict';
// Declared transport fixtures: these tests do not execute the GPU model.
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHmac}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const work=require('../api/_lib/root-work-store'),native=require('../api/_lib/root-text-intelligence');
const budget=require('../api/_lib/root-native-ledger'),contract=require('../api/_lib/root-text-contract');
const {workspace,createHandler}=require('../api/_lib/root-intelligence');
const {MODEL,REVISION}=require('../api/_lib/selling-visual-runtime');
const manifest={operator:'DEMEOS',modelId:MODEL,modelVersion:REVISION,weightsManifestHash:'a'.repeat(64),runtimeCodeHash:'b'.repeat(64),licenceReviewId:'fixture-only',securityReviewId:'fixture-only',benchmarkReviewId:'fixture-not-gpu',benchmarkTimeoutMs:2000,capabilities:['root-text-response']};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fixture',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'fixture',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_ROOT_PERSISTENCE_ENABLED:'true',DEMEOS_ROOT_PREVIEW_OWNER_IDS:'["alice","bob"]',DEMEOS_ROOT_TEXT_PREVIEW_ENABLED:'true',DEMEOS_ROOT_TEXT_RUNTIME_MANIFEST:JSON.stringify(manifest),DEMEOS_VISUAL_RUNTIME_ORIGIN:'https://gpu.example',DEMEOS_VISUAL_RUNTIME_HOST:'gpu.example',DEMEOS_VISUAL_RUNTIME_SECRET:'fixture-only-secret-with-at-least-32-characters'};
const input=(identity='alice',audience='business')=>({schemaVersion:1,inputSchema:contract.CONTRACT.inputSchema,capability:contract.CONTRACT.capability,workspaceId:workspace(identity,audience).workspaceId,audience,requestId:randomUUID(),outputLocale:'en',text:'Help me plan a meeting.',media:[]});
const output={schemaVersion:1,outputSchema:contract.CONTRACT.outputSchema,reply:'Fixture advisory reply.'};
const response=()=>({output,measurements:{durationMs:1,peakVramBytes:1}});
const fakeLedger=()=>({claim:async({input})=>({status:'claimed',claimId:input.requestId}),finish:async({result,uncertain})=>({status:result?'succeeded':uncertain?'uncertain':'failed'})});

test('text configuration is Preview-only, separately opted in, pinned and default off',()=>{
 assert.ok(native.configuration(env));assert.equal(env.DEMEOS_VISUAL_RUNTIME_ENABLED,undefined);
 for(const change of [{DEMEOS_ROOT_TEXT_PREVIEW_ENABLED:'false'},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{POSTGRES_URL:'postgres://fixture@production.example/db'},{DEMEOS_VISUAL_RUNTIME_ORIGIN:'http://gpu.example'},{DEMEOS_VISUAL_RUNTIME_ORIGIN:'https://other.example'},{DEMEOS_ROOT_TEXT_RUNTIME_MANIFEST:JSON.stringify({...manifest,capabilities:['image-semantics']})},{DEMEOS_ROOT_TEXT_RUNTIME_MANIFEST:JSON.stringify({...manifest,benchmarkTimeoutMs:4000})}])assert.equal(native.configuration({...env,...change}),null);
 for(const extra of [{businessId:'borrowed'},{endpoint:'https://other.example'},{media:['url']},{text:'x'.repeat(501)},{outputLocale:'unknown'}])assert.equal(contract.validateInput({...input(),...extra}),false);
 for(const reply of ['', '<script>', 'x'.repeat(501),'bad\u000bcontrol'])assert.equal(contract.validateOutput({...output,reply}),false);
});

test('ROOT text uses the shared signed transport and rejects provenance substitution without retry',async()=>{
 let calls=0,wrong=false;const finishes=[];
 const fetchImpl=async(url,options)=>{
  calls++;assert.equal(url,'https://gpu.example/v1/infer');assert.equal(options.redirect,'error');
  assert.equal(options.headers['X-DEMEOS-Signature'],createHmac('sha256',env.DEMEOS_VISUAL_RUNTIME_SECRET).update(options.body).digest('hex'));
  const wire=JSON.parse(require('node:zlib').gunzipSync(options.body));assert.deepEqual(wire.media,[]);assert.equal(wire.input.businessId,undefined);
  return Response.json({protocolVersion:1,jobId:wire.jobId,inputHash:wire.inputHash,modelVersion:REVISION,weightsManifestHash:manifest.weightsManifestHash,runtimeCodeHash:wrong?'c'.repeat(64):manifest.runtimeCodeHash,...response()});
 };
 const ledger=fakeLedger(),finish=ledger.finish;ledger.finish=async value=>{finishes.push(value);return finish(value);};
 const runner=native.createRunner({environment:env,ledger,authorize:async()=>true,fetchImpl});
 const success=await runner.execute(input());assert.equal(success.status,'succeeded');assert.equal(success.resourceUsage.executions,1);assert.equal(success.resourceUsage.retries,0);
 wrong=true;assert.equal((await runner.execute(input())).status,'failed');assert.equal(calls,2);assert.equal(finishes.at(-1).uncertain,true);
});

test('scope denial, revoked scope and invalid model output never become saved successes',async()=>{
 let calls=0,checks=0,allowed=false;const records=[];const ledger=fakeLedger();ledger.claim=async({input})=>{records.push('claim');return {status:'claimed',claimId:input.requestId};};ledger.finish=async data=>{records.push(data);return {status:data.result?'succeeded':data.uncertain?'uncertain':'failed'};};
 const runner=native.createRunner({environment:env,ledger,authorize:async()=>{checks++;return allowed;},transport:async()=>{calls++;allowed=false;return response();}});
 assert.equal((await runner.execute(input())).status,'rejected');assert.equal(records.length,0);assert.equal(calls,0);
 allowed=true;assert.equal((await runner.execute(input())).code,'scope-revoked');assert.equal(calls,1);assert.equal(records.at(-1).uncertain,undefined);
 const invalid=native.createRunner({environment:env,ledger,authorize:async()=>true,transport:async()=>({...response(),output:{...output,reply:'<invalid>'}})});
 assert.equal((await invalid.execute(input())).code,'invalid-model-output');assert.equal(records.at(-1).code,'invalid-model-output');assert.equal(records.at(-1).uncertain,undefined);
});

test('the whole two-second deadline bounds hanging admission, authorisation and native dispatch',async()=>{
 await Promise.all(['admission','authorisation','transport'].map(async stage=>{
  let release,calls=0;const records=[];const pending=new Promise(resolve=>{release=resolve;});const ledger=fakeLedger();
  if(stage==='admission')ledger.claim=()=>pending;
  ledger.finish=async value=>{records.push(value);return {status:value.uncertain?'uncertain':'failed'};};
  const runner=native.createRunner({environment:env,ledger,authorize:()=>stage==='authorisation'?pending:Promise.resolve(true),transport:()=>{calls++;return pending;}});
  const request=input(),started=Date.now(),result=await runner.execute(request);
  assert.equal(result.code,'execution-timeout');assert.ok(Date.now()-started<2600);assert.equal(calls,stage==='transport'?1:0);
  release(stage==='admission'?{status:'claimed',claimId:request.requestId}:stage==='transport'?response():true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,stage==='transport'?1:0,'late admission cannot dispatch');
  if(stage==='admission')assert.equal(records.at(-1).executions,0);
  if(stage==='transport')assert.equal(records.at(-1).uncertain,true);
 }));
});

test('SQL budgets share personal contexts, preserve uncertainty, reject foreign claims and enforce quotas',async()=>{
 const client=new PGlite(),database=createDatabase(client);
 try{
  for(const sql of [...work.SCHEMA,...budget.SCHEMA])await database.query(sql);
  const business=workspace('alice','business'),customer=workspace('alice','customer');
  const ledger=budget.createLedger(database,{identity:'alice',workspace:business}),other=budget.createLedger(database,{identity:'alice',workspace:customer});
  const a=input(),b=input('alice','customer'),inputHash='d'.repeat(64);
  assert.equal((await budget.createLedger(database,{identity:'bob',workspace:business}).claim({input:a,inputHash})).status,'denied');
  assert.equal((await ledger.claim({input:a,inputHash})).status,'claimed');
  assert.equal((await other.claim({input:b,inputHash})).status,'limited');
  assert.equal((await other.finish({claimId:a.requestId,inputHash,executions:1})).status,'unchanged');
  assert.equal((await ledger.finish({claimId:a.requestId,inputHash,uncertain:true,executions:1})).status,'uncertain');
  assert.equal((await other.claim({input:b,inputHash})).status,'limited');
  assert.equal((await ledger.claim({input:{...a,text:'Changed'},inputHash:'e'.repeat(64)})).status,'conflict');
  const bob=budget.createLedger(database,{identity:'bob',workspace:workspace('bob','business')});
  for(let i=0;i<20;i++){const v=input('bob');assert.equal((await bob.claim({input:v,inputHash})).status,'claimed');assert.equal((await bob.finish({claimId:v.requestId,inputHash})).status,'failed');}
  assert.equal((await bob.claim({input:input('bob'),inputHash})).status,'limited');
  await database.query("UPDATE demeos_root_native_jobs SET created_at=NOW()-INTERVAL '2 hours' WHERE owner_key=$1",[contract.principalKey('bob')]);
  for(let i=20;i<100;i++){const v=input('bob');await bob.claim({input:v,inputHash});await bob.finish({claimId:v.requestId,inputHash});await database.query("UPDATE demeos_root_native_jobs SET created_at=NOW()-INTERVAL '2 hours' WHERE request_id=$1",[v.requestId]);}
  assert.equal((await bob.claim({input:input('bob'),inputHash})).status,'limited');
 }finally{await client.close();}
});

test('ROOT text composes real SQL claim, save, cache reuse, reload and private review without Selling authority',async()=>{
 const client=new PGlite(),database=createDatabase(client),store=work.createStore(database);let calls=0,enabled=true;
 try{
  for(const sql of [...work.SCHEMA,...budget.SCHEMA])await database.query(sql);
  const handler=createHandler({environment:()=>({...env,DEMEOS_ROOT_TEXT_PREVIEW_ENABLED:String(enabled)}),authenticate:async req=>({trustedIdentityId:req.fixtureIdentity||'alice'}),repository:()=>{throw Error('Selling must not be used');},workStore:()=>store,textLedgerFactory:options=>budget.createLedger(database,options),textRunnerFactory:options=>native.createRunner({...options,transport:async()=>{calls++;return response();}})});
  async function call(body,identity='alice',audience='business'){
   const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
   await handler({method:body?'POST':'GET',headers:{'content-type':'application/json'},query:{audience},body,fixtureIdentity:identity},res);return res;
  }
  const body={action:'ask-root',audience:'business',locale:'en',text:'Help me plan a meeting.',confirmed:true,saveConfirmed:true,requestId:randomUUID()};
  enabled=false;assert.equal((await call(body)).code,503);assert.equal(calls,0);enabled=true;
  for(const patch of [{confirmed:false},{saveConfirmed:false},{workspaceId:workspace('bob','business').workspaceId},{businessId:'borrowed'},{text:'x'.repeat(501)}])assert.equal((await call({...body,...patch})).code,400);
  assert.equal(calls,0);const first=await call(body);assert.equal(first.code,201);assert.equal(first.body.result.engine.kind,'native-root-text');assert.equal(first.body.result.conversation.verified,false);
  const duplicate=await call(body);assert.equal(duplicate.code,201);assert.equal(duplicate.body.work.work_id,first.body.work.work_id);assert.equal(calls,1);
  assert.deepEqual(duplicate.body.result.conversation,first.body.result.conversation,'cache reuse must preserve the original inference evidence');
  assert.equal((await call({...body,text:'Different'})).code,429);assert.equal(calls,1);
  const saved=first.body.work;assert.equal((await call()).body.history.works.length,1);assert.equal((await call(undefined,'alice','customer')).body.history.works.length,0);assert.equal((await call(undefined,'bob')).body.history.works.length,0);
  const review={action:'review-work',audience:'business',confirmed:true,workId:saved.work_id,revision:1,decision:'corrected',text:'Owner correction'};
  assert.equal((await call(review,'bob')).code,403);assert.equal((await call({...review,audience:'customer'})).code,403);assert.equal((await call(review)).code,200);
  const reloaded=(await call()).body.history.works[0];assert.equal(reloaded.reviewed_text,'Owner correction');assert.deepEqual(reloaded.result,saved.result);
  const customer=await call({...body,audience:'customer',requestId:randomUUID()});assert.equal(customer.code,201);assert.equal(calls,2);
  const rows=await database.query('SELECT state,executions FROM demeos_root_native_jobs');assert.ok(rows.rows.every(row=>row.state==='succeeded'&&row.executions===1));
 }finally{await client.close();}
});

test('cached native evidence must match the exact request, context and reviewed model pins',async()=>{
 const request=input();let saved;
 const ledger=fakeLedger();ledger.finish=async({result,uncertain})=>{if(result)saved=structuredClone(result);return {status:result?'succeeded':uncertain?'uncertain':'failed'};};
 const runner=native.createRunner({environment:env,ledger,authorize:async()=>true,transport:async()=>response()});
 assert.equal((await runner.execute(request)).status,'succeeded');
 for(const mutation of [v=>{v.output.reply='<unsafe>';},v=>{v.provenance.workspaceId=workspace('bob','business').workspaceId;},v=>{v.provenance.audience='customer';},v=>{v.provenance.runtimeCodeHash='f'.repeat(64);},v=>{v.provenance.inputHash='f'.repeat(64);},
  v=>{v.code='unreviewed-success';},v=>{v.provenance.operator='other';},v=>{v.provenance.at='invalid';},
  v=>{delete v.measurements;},v=>{v.measurements.durationMs=2001;},v=>{v.measurements.peakVramBytes=-1;},
  v=>{v.resourceUsage.executions=0;},v=>{v.resourceUsage.retries=1;},v=>{v.resourceUsage.durationMs=2000;},
  v=>{v.resourceUsage.inputBytes++;},v=>{v.resourceUsage.outputBytes++;}]){
  const cached=structuredClone(saved);mutation(cached);
  const cachedRunner=native.createRunner({environment:env,ledger:{...fakeLedger(),claim:async()=>({status:'cached',result:cached})},authorize:async()=>true,transport:async()=>{throw Error('cache cannot dispatch');}});
  assert.equal((await cachedRunner.execute(request)).code,'invalid-cache');
 }
});

test('a hanging post-execution grant check or ledger completion cannot extend the deadline or fabricate success',async()=>{
 await Promise.all(['post-grant','completion'].map(async stage=>{
  let checks=0,calls=0,release;const pending=new Promise(resolve=>{release=resolve;});
  const ledger=fakeLedger();if(stage==='completion')ledger.finish=()=>pending;
  const runner=native.createRunner({environment:env,ledger,authorize:async()=>++checks===3&&stage==='post-grant'?pending:true,transport:async()=>{calls++;return response();}});
  const started=Date.now(),result=await runner.execute(input());
  assert.equal(result.code,'execution-timeout');assert.equal(result.status,'failed');assert.ok(Date.now()-started<2600);assert.equal(calls,1);
  release(stage==='post-grant'?true:{status:'succeeded'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
 }));
});
