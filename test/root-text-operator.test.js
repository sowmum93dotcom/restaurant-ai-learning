'use strict';
// Operator contract fixtures only. No network or GPU execution is performed.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {promisify}=require('node:util'),execFile=promisify(require('node:child_process').execFile);
const operator=path.resolve(__dirname,'../tools/visual-runtime/root-text-acceptance.js');
async function run(mode){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'root-operator-'));
 try{
  const secret=path.join(dir,'secret'),output=path.join(dir,'report.json'),preload=path.join(dir,'fixture.cjs'),calls=path.join(dir,'calls');
  fs.writeFileSync(secret,'fixture-only-never-a-real-service-secret',{mode:0o600});
  fs.writeFileSync(preload,`
   const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
   const {MODEL,REVISION}=require(${JSON.stringify(path.resolve(__dirname,'../api/_lib/selling-visual-runtime'))});
   const mode=${JSON.stringify(mode)},calls=${JSON.stringify(calls)};
   globalThis.fetch=async(url,options)=>{
    if(!url.startsWith('https://fixture.invalid/'))throw Error('unexpected-destination');
    if(options.redirect!=='error')throw Error('redirects-must-be-disabled');
    if(url.endsWith('/healthz')){
     let health={ready:true,busy:false,modelId:MODEL,modelVersion:REVISION,weightsManifestHash:'a'.repeat(64),runtimeCodeHash:'b'.repeat(64)};
     if(mode==='truthy')health.ready='true';
     if(mode==='missing-busy')delete health.busy;
     if(mode==='extra')health.unreviewed=true;
     if(mode==='wrong-code')health.runtimeCodeHash='c'.repeat(64);
     return Response.json(health,{status:mode==='accepted-http'?202:200});
    }
    fs.appendFileSync(calls,'dispatch\\n');
    if(mode==='server-timeout')return Response.json({code:'execution-timeout'},{status:504});
    if(mode==='server-limit')return Response.json({code:'model-output-limit'},{status:502});
    if(mode==='untrusted-error')return Response.json({code:'private server details'},{status:502});
    if(mode==='timeout')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    const job=JSON.parse(gunzipSync(options.body));
    return Response.json({protocolVersion:1,jobId:job.jobId,inputHash:job.inputHash,modelVersion:job.modelVersion,weightsManifestHash:job.weightsManifestHash,runtimeCodeHash:job.runtimeCodeHash,output:{schemaVersion:1,outputSchema:'demeos-root-text-output-v1',reply:mode==='invalid-output'?'<invalid>':'Fixture response only.'},measurements:{durationMs:1,peakVramBytes:1}});
   };
  `);
  let exitCode=0;
  try{await execFile(process.execPath,['--require',preload,operator,'--origin','https://fixture.invalid','--secret-file',secret,'--weights-manifest-hash','a'.repeat(64),'--runtime-code-hash','b'.repeat(64),'--output',output],{timeout:10000});}catch(error){exitCode=error.code;}
  return {report:JSON.parse(fs.readFileSync(output,'utf8')),dispatches:fs.existsSync(calls)?fs.readFileSync(calls,'utf8').trim().split('\n').length:0,exitCode};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('ROOT text operator refuses malformed readiness and non-200 health before dispatch',async()=>{
 for(const mode of ['truthy','missing-busy','extra','wrong-code','accepted-http']){
  const result=await run(mode);assert.equal(result.exitCode,1,mode);assert.equal(result.dispatches,0,mode);assert.equal(result.report.executionPassed,false);assert.equal(result.report.results.length,0);
 }
});
test('ROOT text operator preserves invalid output and stops after one failed execution',async()=>{
 const {report,dispatches,exitCode}=await run('invalid-output');assert.equal(exitCode,1);assert.equal(dispatches,1);assert.equal(report.results.length,1);assert.equal(report.results[0].output.reply,'<invalid>');assert.equal(report.results[0].error,'model-output-invalid');assert.equal(report.executionPassed,false);
});
test('ROOT text operator timeout stops without a second dispatch or automatic retry',async()=>{
 const {report,dispatches,exitCode}=await run('timeout');assert.equal(exitCode,1);assert.equal(dispatches,1);assert.equal(report.results.length,1);assert.equal(report.results[0].passed,false);assert.equal(report.results[0].retries,0);assert.equal(report.results[0].error,'execution-timeout');assert.equal(report.executionPassed,false);
});
test('ROOT text operator preserves fixed supervisor failures and discards arbitrary error text',async()=>{
 for(const [mode,code] of [['server-timeout','execution-timeout'],['server-limit','model-output-limit'],['untrusted-error','native-request-failed']]){
  const {report,dispatches,exitCode}=await run(mode);assert.equal(exitCode,1);assert.equal(dispatches,1);assert.equal(report.results.length,1);assert.equal(report.results[0].error,code);assert.equal(report.results[0].retries,0);assert.equal(report.executionPassed,false);assert.equal(JSON.stringify(report).includes('private server details'),false);
 }
});
test('ROOT text operator records all controlled cases without granting quality or activation',async()=>{
 const {report,dispatches,exitCode}=await run('success');assert.equal(exitCode,0);assert.equal(dispatches,12);assert.equal(report.results.length,12);assert.equal(report.executionPassed,true);assert.equal(report.productAccuracyVerified,false);assert.equal(report.multilingualAccuracyVerified,false);assert.equal(report.activationApproved,false);
});
