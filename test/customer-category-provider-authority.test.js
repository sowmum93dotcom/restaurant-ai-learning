'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCategoryProviderAuthority,verifyCategoryProviderReport}=require('../api/_lib/customer-category-provider-authority');
const {definitionFingerprint,PROTOCOL,createCategoryProviderIntegration}=require('../api/_lib/customer-category-provider-integration');
const {PURPOSE,BASELINE_VERSION,SCHEMA_VERSION,evaluateCustomerCategories,understandCustomerCategories}=require('../api/_lib/customer-category-understanding');
const {DATASET_VERSION}=require('../api/_lib/marketing-agent-categories');
const {LOCALES,fingerprint}=require('../api/_lib/customer-evidence-provenance');
const {evaluateReviewedCategoryProvider,DIMENSIONS}=require('../api/_lib/customer-category-reviewed-evaluation');
const definition={schemaVersion:2,providerVersion:'controlled-v2',providerIdentity:'controlled-provider',modelVersion:'controlled-model-v1',endpoint:'https://semantic.example.org/category',protocol:PROTOCOL,datasetVersion:DATASET_VERSION};
const fp=definitionFingerprint(definition);
function fixture(audience='offline-evaluation'){
 const signal=new AbortController().signal,store=new Map();
 const envelope=(kind,decisionId,payload)=>({schemaVersion:1,decisionId,decision:'approved',kind,artifactFingerprint:fp,purpose:PURPOSE,audience,locales:[...LOCALES],expiresAt:2000,payload});
 const receipt={rollbackVersion:BASELINE_VERSION,configurationFingerprint:fp,independentlyVerified:true,reportFingerprint:null,datasetFingerprint:null,realProviderOutputs:false};
 const payload={providerIdentity:definition.providerIdentity,endpoint:definition.endpoint,modelVersion:definition.modelVersion,configurationFingerprint:fp,rollbackVersion:BASELINE_VERSION,privacyReviewId:'privacy',securityReviewId:'security',evaluationReviewId:null,regressionReviewId:null,rollbackReviewId:null,activationDecisionId:null};
 store.set('provider-release:controlled-v2',envelope('provider-release','controlled-v2',payload));
 for(const [kind,key] of [['privacyReviewId','privacy'],['securityReviewId','security']])store.set(kind+':'+key,envelope(kind,key,{...receipt}));
 const clock={value:1000},onRead={fn:null};
 const authority=createCategoryProviderAuthority({definition,audience,now:()=>clock.value,readRecord:async({kind,reference})=>{if(onRead.fn)await onRead.fn(kind,reference);return store.get(kind+':'+reference);}});
 const release={candidateVersion:definition.providerVersion,artifactFingerprint:fp,purpose:PURPOSE,rollbackVersion:BASELINE_VERSION,audience,locale:'en',scope:'customer-request',signal};
 return {authority,clock,onRead,store,envelope,receipt,payload,release,signal};
}
test('server authority binds provider identity, endpoint, model and fingerprint with current reviews',async()=>{
 const f=fixture();assert.equal((await f.authority.resolveRelease(f.release)).approved,true);
 for(const key of ['providerIdentity','endpoint','modelVersion','configurationFingerprint','rollbackVersion']){const before=f.payload[key];f.payload[key]='changed';assert.equal(await f.authority.resolveRelease(f.release),null,key);f.payload[key]=before;}
 const record=f.store.get('securityReviewId:security');record.decision='revoked';assert.equal(await f.authority.resolveRelease(f.release),null);
});
test('legacy definitions cannot obtain new server authority and v2 identity/model change fingerprints',()=>{
 const legacy={...definition,schemaVersion:1};delete legacy.providerIdentity;delete legacy.modelVersion;
 assert.throws(()=>createCategoryProviderAuthority({definition:legacy,readRecord:async()=>null}));
 for(const key of ['providerIdentity','modelVersion'])assert.notEqual(definitionFingerprint({...definition,[key]:'other'}),fp);
});
test('missing, expired, wrong audience, malformed and failed authority records deny release',async()=>{
 for(const patch of [{expiresAt:1000},{audience:'production'},{artifactFingerprint:'a'.repeat(64)},{locales:['en','en']},{extra:true}]){const f=fixture();Object.assign(f.store.get('provider-release:controlled-v2'),patch);assert.equal(await f.authority.resolveRelease(f.release),null);}
 const a=createCategoryProviderAuthority({definition,readRecord:async()=>{throw new Error('private-store-details');}});assert.equal(await a.resolveRelease(fixture().release),null);
 const f=fixture();f.signal.throwIfAborted();const c=new AbortController();c.abort();assert.equal(await f.authority.resolveRelease({...f.release,signal:c.signal}),null);
});
function source(f,text='wedding food',scope='customer-request'){
 const sourceReference=scope==='customer-request'?null:{workItemId:'work',productId:'product'};
 const requestFingerprint=fingerprint({schemaVersion:SCHEMA_VERSION,datasetVersion:DATASET_VERSION,text,locale:'en',scope,sourceReference});
 const payload={policyVersion:'reviewed-policy-v1',requestFingerprint,scope,sourceReference,dataMinimised:true,controlledTest:false,sourceVerified:true,learningExportAllowed:false};
 f.store.set('source-policy:'+requestFingerprint,f.envelope('source-policy',requestFingerprint,payload));
 return {request:{purpose:PURPOSE,text,locale:'en',scope,sourceReference,requestFingerprint,signal:f.signal},payload};
}
test('reviewed source policy binds exact request and same verified offer without learning/export permission',async()=>{
 for(const scope of ['customer-request','published-offer']){
  const f=fixture(),s=source(f,'wedding food',scope);assert.equal((await f.authority.authorizeData(s.request)).allowed,true);
  for(const patch of [{dataMinimised:false},{controlledTest:true},{sourceVerified:false},{learningExportAllowed:true},{scope:'other'},{sourceReference:{workItemId:'other',productId:'other'}}]){const before={...s.payload};Object.assign(s.payload,patch);assert.equal(await f.authority.authorizeData(s.request),null);Object.assign(s.payload,before);}
  assert.equal(await f.authority.authorizeData({...s.request,text:'changed'}),null);
 }
});
test('source policy denies obvious contacts/secrets, unknown source and missing decisions',async()=>{
 const f=fixture();for(const text of ['private@example.org','token=secret','07123456789'])assert.equal(await f.authority.authorizeData(source(f,text).request),null);
 assert.equal(await f.authority.authorizeData({...source(f).request,sourceReference:{email:'private'}}),null);
 const request=source(f).request;f.store.clear();assert.equal(await f.authority.authorizeData(request),null);
});
test('production approval fails without independently verified evaluation, regression, rollback and activation',async()=>{
 const f=fixture('production');assert.equal(await f.authority.resolveRelease(f.release),null);
 for(const key of ['evaluationReviewId','regressionReviewId','rollbackReviewId','activationDecisionId']){f.payload[key]=key;f.store.set(key+':'+key,f.envelope(key,key,{...f.receipt}));}
 assert.equal(await f.authority.resolveRelease(f.release),null,'opaque evaluation ID alone cannot authorize activation');
});
test('real adapter uses server decisions; missing policy preserves baseline without transport',async()=>{
 const f=fixture();let calls=0;
 const integration=createCategoryProviderIntegration({definition,...f.authority,resolveValidation:async()=>null,resolveCredentials:async()=> 'Bearer controlled',transport:async()=>{calls++;return '{}';}});
 await evaluateCustomerCategories({text:'Catering Services',configuration:{categoryUnderstanding:integration}});assert.equal(calls,0);
 await understandCustomerCategories({text:'Catering Services',configuration:{categoryUnderstanding:integration}});assert.equal(calls,0);
});
test('reviewed evaluation remains label-free, multilingual and refuses incomplete coverage or fabricated receipt',async()=>{
 const cases=LOCALES.map(locale=>({caseId:'case-'+locale,locale,text:'Catering Services',expectedCategoryIds:['89'],allowFallback:false,positiveUnsafe:false,responseScenario:'normal',judgement:'independently-judged'}));
 const review={approved:true,datasetFingerprint:fingerprint(cases),datasetVersion:'customer-category-eval-v1',decisionId:'independent-controlled-review',locales:[...LOCALES]};
 const dataset={schemaVersion:1,datasetId:'controlled-dataset',reviewDecisionId:review.decisionId,cases,independentReview:review,coverage:cases.flatMap(row=>DIMENSIONS.map(dimension=>({caseId:row.caseId,dimension})))};
 const report=await evaluateReviewedCategoryProvider({datasetId:dataset.datasetId,readEvaluation:async()=>dataset,categoryUnderstanding:null});
 assert.equal(report.releaseGatePassed,false);assert.equal(report.metrics.providerAccuracy,null);assert.equal(report.metrics.baselineAccuracy,1);assert.equal(Object.keys(report.evaluationCoverage).length,9);
 assert.equal(verifyCategoryProviderReport(report,{providerVersion:definition.providerVersion,artifactFingerprint:fp,reportFingerprint:report.reportFingerprint,datasetFingerprint:review.datasetFingerprint}),false);
 dataset.coverage.push({caseId:'unknown',dimension:'paraphrase'});await assert.rejects(evaluateReviewedCategoryProvider({datasetId:dataset.datasetId,readEvaluation:async()=>dataset}),/coverage/);
});
test('production accepts only exact independently verified real-output report and remains revocable',async()=>{
 const f=fixture('production');
 const cases=LOCALES.map(locale=>({caseId:'real-controlled-'+locale,locale,status:'correct-classification',executionOrigin:'provider',executionReason:'validated_category_understanding'}));
 // Controlled receipt fixture: not a real evaluation or production approval.
 const report={schemaVersion:1,datasetVersion:'customer-category-eval-v1',reviewDecisionId:'controlled-independent-review',categoryDatasetVersion:DATASET_VERSION,datasetFingerprint:'b'.repeat(64),providerVersion:definition.providerVersion,artifactFingerprint:fp,independentlyReviewed:true,releaseGatePassed:true,rows:cases,counts:{'correct-classification':9,'incorrect-classification':0,'unsafe-classification':0,'safe-fallback':0},metrics:{pipelineAccuracy:1,baselineAccuracy:null,providerCoverage:1,baselineCases:0,providerRejectedOrUnavailableCases:0,unsafeClassificationRate:0,providerAccuracy:1},localeMetrics:Object.fromEntries(LOCALES.map(locale=>[locale,{cases:1,providerCases:1,providerAccuracy:1,unsafeClassificationRate:0}])),evaluationCoverage:Object.fromEntries(LOCALES.map(locale=>[locale,Object.fromEntries(DIMENSIONS.map(d=>[d,1]))]))};
 report.reportFingerprint=fingerprint(report);
 for(const key of ['evaluationReviewId','regressionReviewId','rollbackReviewId','activationDecisionId']){f.payload[key]=key;f.store.set(key+':'+key,f.envelope(key,key,{...f.receipt,reportFingerprint:report.reportFingerprint,datasetFingerprint:report.datasetFingerprint,realProviderOutputs:true}));}
 f.store.set('evaluation-report:'+report.reportFingerprint,f.envelope('evaluation-report',report.reportFingerprint,report));
 assert.equal((await f.authority.resolveRelease(f.release)).approved,true);
 const originalDataset=report.datasetFingerprint;
 for(const invalid of [null,'arbitrary','a'.repeat(63),'A'.repeat(64),42]){
  report.datasetFingerprint=invalid;report.reportFingerprint=fingerprint({...report,reportFingerprint:undefined});
  const receipt=f.store.get('evaluationReviewId:evaluationReviewId').payload;receipt.datasetFingerprint=invalid;receipt.reportFingerprint=report.reportFingerprint;
  f.store.set('evaluation-report:'+report.reportFingerprint,f.envelope('evaluation-report',report.reportFingerprint,report));
  assert.equal(await f.authority.resolveRelease(f.release),null,'invalid dataset fingerprint cannot authorize release');
 }
 report.datasetFingerprint=originalDataset;delete report.reportFingerprint;report.reportFingerprint=fingerprint(report);
 const receipt=f.store.get('evaluationReviewId:evaluationReviewId').payload;receipt.datasetFingerprint=originalDataset;receipt.reportFingerprint=report.reportFingerprint;
 f.store.set('evaluation-report:'+report.reportFingerprint,f.envelope('evaluation-report',report.reportFingerprint,report));
 report.metrics.providerAccuracy=.5;assert.equal(await f.authority.resolveRelease(f.release),null,'changed report fails fingerprint');
 report.metrics.providerAccuracy=1;f.store.get('activationDecisionId:activationDecisionId').decision='revoked';assert.equal(await f.authority.resolveRelease(f.release),null);
});
test('reviewed evaluation rejects nested getters without executing them',async()=>{
 let invoked=false;const nested={};Object.defineProperty(nested,'text',{get(){invoked=true;return 'private';},enumerable:true});
 await assert.rejects(evaluateReviewedCategoryProvider({datasetId:'data',readEvaluation:async()=>({cases:[nested]})}));assert.equal(invoked,false);
});
test('reports cannot invent locale provider coverage or credit baseline as evaluated AI',()=>{
 const rows=LOCALES.map(locale=>({caseId:locale,locale,status:'correct-classification',executionOrigin:'provider',executionReason:'validated_category_understanding'}));
 const report={schemaVersion:1,datasetVersion:'customer-category-eval-v1',reviewDecisionId:'controlled-independent-review',categoryDatasetVersion:DATASET_VERSION,datasetFingerprint:'b'.repeat(64),providerVersion:definition.providerVersion,artifactFingerprint:fp,independentlyReviewed:true,releaseGatePassed:true,rows,counts:{'correct-classification':9,'incorrect-classification':0,'unsafe-classification':0,'safe-fallback':0},metrics:{pipelineAccuracy:1,baselineAccuracy:null,providerCoverage:1,baselineCases:0,providerRejectedOrUnavailableCases:0,unsafeClassificationRate:0,providerAccuracy:1},localeMetrics:Object.fromEntries(LOCALES.map(locale=>[locale,{cases:1,providerCases:1,providerAccuracy:1,unsafeClassificationRate:0}])),evaluationCoverage:Object.fromEntries(LOCALES.map(locale=>[locale,Object.fromEntries(DIMENSIONS.map(d=>[d,1]))]))};
 function verify(value){const copy=structuredClone(value);copy.reportFingerprint=fingerprint(copy);return verifyCategoryProviderReport(copy,{providerVersion:definition.providerVersion,artifactFingerprint:fp,reportFingerprint:copy.reportFingerprint,datasetFingerprint:copy.datasetFingerprint});}
 assert.equal(verify(report),true);
 const english=structuredClone(report);english.rows=english.rows.slice(0,1);english.counts['correct-classification']=1;for(const locale of LOCALES.slice(1))english.localeMetrics[locale].cases=0;assert.equal(verify(english),false);
 const fallback=structuredClone(report);fallback.rows[1].executionOrigin='baseline';assert.equal(verify(fallback),false);
 const excessive=structuredClone(report);excessive.localeMetrics.fr.providerCases=2;assert.equal(verify(excessive),false);
});
test('approval rechecks early release and review expiry after asynchronous later reads',async()=>{
 for(const key of ['provider-release:controlled-v2','privacyReviewId:privacy']){
  const f=fixture();f.store.get(key).expiresAt=1001;f.onRead.fn=async kind=>{if(kind==='securityReviewId')f.clock.value=1001;};
  assert.equal(await f.authority.resolveRelease(f.release),null,key);
 }
});
test('report approval distinguishes allowed negation baseline from actual provider failure',()=>{
 const rows=LOCALES.map(locale=>({caseId:locale,locale,status:'correct-classification',executionOrigin:'provider',executionReason:'validated_category_understanding'}));
 rows.push({caseId:'negated-en',locale:'en',status:'correct-classification',executionOrigin:'baseline',executionReason:'category_negation_baseline'});
 const report={schemaVersion:1,datasetVersion:'customer-category-eval-v1',reviewDecisionId:'controlled-independent-review',categoryDatasetVersion:DATASET_VERSION,datasetFingerprint:'b'.repeat(64),providerVersion:definition.providerVersion,artifactFingerprint:fp,independentlyReviewed:true,releaseGatePassed:true,rows,counts:{'correct-classification':10,'incorrect-classification':0,'unsafe-classification':0,'safe-fallback':0},metrics:{pipelineAccuracy:1,baselineAccuracy:1,providerCoverage:.9,baselineCases:1,providerRejectedOrUnavailableCases:0,unsafeClassificationRate:0,providerAccuracy:1},localeMetrics:Object.fromEntries(LOCALES.map(locale=>[locale,{cases:locale==='en'?2:1,providerCases:1,providerAccuracy:1,unsafeClassificationRate:0}])),evaluationCoverage:Object.fromEntries(LOCALES.map(locale=>[locale,Object.fromEntries(DIMENSIONS.map(d=>[d,1]))]))};
 function verify(){const copy=structuredClone(report);copy.reportFingerprint=fingerprint(copy);return verifyCategoryProviderReport(copy,{providerVersion:definition.providerVersion,artifactFingerprint:fp,reportFingerprint:copy.reportFingerprint,datasetFingerprint:copy.datasetFingerprint});}
 assert.equal(verify(),true);
 for(const reason of ['category_provider_fallback','category_source_permission_required','category_audience_required',null]){report.rows[9].executionReason=reason;assert.equal(verify(),false,reason);}
 report.rows[9].executionReason='validated_category_understanding';assert.equal(verify(),false,'baseline cannot claim validated provider');
});
