#!/usr/bin/env node
'use strict';
// Operator only. Uses the existing signed transport and Python-validated pack.
// No application flags, credentials or commercial records are changed here.
const fs=require('node:fs'),{createHash}=require('node:crypto');
const {sendNativeRequest,readBounded}=require('../../api/_lib/native-runtime-transport');
const {validateVisualInput,validateVisualOutput,VISUAL_CONTRACT}=require('../../api/_lib/selling-model-boundary');
const {validHealth}=require('../../api/_lib/root-runtime-health');
const {MODEL,REVISION}=require('../../api/_lib/selling-visual-runtime');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){
 if(!['--origin','--secret-file','--weights-manifest-hash','--runtime-code-hash','--prepared-pack','--output'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('invalid-arguments');
 options[args[i]]=args[i+1];
}
if(Object.keys(options).length!==6)throw Error('six-required-arguments');
const origin=new URL(options['--origin']);
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('exact-https-origin-required');
if(!digest(options['--weights-manifest-hash'])||!digest(options['--runtime-code-hash']))throw Error('pinned-manifest-required');
const stat=fs.statSync(options['--secret-file']);
if(!stat.isFile()||stat.size>257||(stat.mode&0o077))throw Error('private-secret-file-required');
const secret=fs.readFileSync(options['--secret-file'],'utf8').trim();
if(!/^[!-~]{32,256}$/.test(secret))throw Error('invalid-secret');
const prepared=JSON.parse(fs.readFileSync(options['--prepared-pack'],'utf8'));
if(!digest(prepared.packHash)||prepared.pack?.scope!=='repository-controlled-fixtures'||prepared.pack.cases?.length!==31)throw Error('original-31-case-pack-required');
const config={origin:origin.origin,secret,manifest:{modelId:MODEL,modelVersion:REVISION,weightsManifestHash:options['--weights-manifest-hash'],runtimeCodeHash:options['--runtime-code-hash']}};
const jobs=prepared.pack.cases.map(item=>{
 const asset=prepared.assets[item.asset];
 if(!asset||asset.length!==2||hash(Buffer.from(asset[1],'base64'))!==asset[0].contentHash||Buffer.from(asset[1],'base64').length!==asset[0].sizeBytes)throw Error('prepared-asset-integrity-failed');
 const input={schemaVersion:2,inputSchema:VISUAL_CONTRACT.inputSchema,capability:'image-semantics',businessId:'test-business-acceptance',productId:item.id,productRevision:hash(item.text),mediaRevision:asset[0].contentHash,media:[asset[0]],text:item.text,outputLocale:item.locale};
 if(!validateVisualInput(input))throw Error('invalid-controlled-input');
 return {item,input,encoded:asset[1]};
});
const report={schemaVersion:1,scope:'repository-controlled-fixtures',route:'same-application-signed-native-https-transport',...config.manifest,packHash:prepared.packHash,operatorSourceHash:hash(fs.readFileSync(__filename)),timeoutMs:2000,plannedCaseCount:31,results:[],executionPassed:false,productAccuracyVerified:false,multilingualAccuracyVerified:false,activationApproved:false};
const file=fs.openSync(options['--output'],'wx',0o600);
function checkpoint(){const raw=JSON.stringify(report,null,2)+'\n';fs.ftruncateSync(file,0);fs.writeSync(file,raw,0,'utf8');fs.fsyncSync(file);}
(async()=>{
 try{
  checkpoint();const signal=AbortSignal.timeout(10000);
  const response=await fetch(config.origin+'/healthz',{redirect:'error',signal,headers:{Authorization:'Bearer '+secret}});
  if(response.status!==200)throw Error('health-status-invalid');
  const health=JSON.parse((await readBounded(response,2048,signal)).toString());
  if(!validHealth(health,config.manifest))throw Error('health-provenance-mismatch');
  report.health=health;checkpoint();
  for(const {item,input,encoded} of jobs){
   const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2000);
   const result={caseId:item.id,locale:item.locale,assetHash:input.mediaRevision,reviewFocus:item.reviewFocus,humanReview:'pending',passed:false,executions:1,retries:0};
   try{
    const body=await sendNativeRequest({config,input,inputHash:hash(JSON.stringify(input)),limits:VISUAL_CONTRACT.limits,deadline:started+2000,signal:controller.signal,media:[encoded]});
    result.endToEndMs=Date.now()-started;result.output=body.output;result.measurements=body.measurements;
    result.passed=result.endToEndMs<=2000&&validateVisualOutput(body.output,input);
    if(!result.passed)result.error='model-output-invalid-or-deadline';
   }catch(error){result.endToEndMs=Date.now()-started;result.error=controller.signal.aborted||error.message==='execution-timeout'?'execution-timeout':['model-output-limit','model-json-invalid','model-evidence-invalid','model-output-invalid'].includes(error.message)?error.message:'native-request-failed';}
   finally{clearTimeout(timer);controller.abort();}
   report.results.push(result);checkpoint();console.log(item.id+': '+(result.passed?'passed':'failed'));
   if(!result.passed)break;
  }
  report.executionPassed=report.results.length===31&&report.results.every(r=>r.passed);checkpoint();
  console.log(JSON.stringify({executionPassed:report.executionPassed,count:report.results.length,maximumMs:Math.max(...report.results.map(r=>r.endToEndMs))}));
  if(!report.executionPassed)process.exitCode=1;
 }catch{report.failure='acceptance-incomplete';checkpoint();process.exitCode=1;console.error('Native visual acceptance incomplete; inspect private report.');}
 finally{fs.closeSync(file);}
})();
