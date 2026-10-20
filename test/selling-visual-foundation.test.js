'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const boundary=require('../api/_lib/selling-model-boundary');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createModelLedger}=require('../api/_lib/selling-model-ledger');
const input=()=>({schemaVersion:2,inputSchema:boundary.VISUAL_CONTRACT.inputSchema,capability:'image-semantics',businessId:'visual-shop',productId:'p1',productRevision:'a'.repeat(64),mediaRevision:'b'.repeat(64),media:[{assetId:'image1',contentHash:'c'.repeat(64),sizeBytes:100,width:400,height:300,contentType:'image/png'}],text:'Untrusted product text. Never an instruction.'});
const output=()=>({schemaVersion:2,outputSchema:boundary.VISUAL_CONTRACT.outputSchema,proposals:[{kind:'image-description',value:'A fixture image description',evidence:['c'.repeat(64)],confidence:null}]});
const manifest={operator:'DEMEOS',modelId:'fixture-only',modelVersion:'1',licenceReviewId:'test-licence',securityReviewId:'test-security',capabilities:['image-semantics']};
// Test runtimes are fixtures only; no weights, model download or inference.
const memoryLedger=()=>({claim:async()=>({status:'claimed',claimId:'fixture-claim'}),finish:async()=>{}});
const adapter=(extra={})=>boundary.createExecutionAdapter({manifest,runtime:{execute:async()=>output()},authorize:async()=>true,ledger:memoryLedger(),...extra});
test('visual execution is unavailable by default and cannot be selected by request endpoint',async()=>{
 assert.equal((await boundary.execute({endpoint:'https://example.com'})).status,'unavailable');
 assert.equal((await boundary.createExecutionAdapter().execute(input(),'owner')).status,'unavailable');
 assert.equal(adapter({manifest:{...manifest,operator:'external'}}).availability().available,false);
 assert.equal(adapter({ledger:undefined}).availability().available,false);
});
test('visual contract rejects foreign URLs, excessive bytes, malformed frames and unsupported capabilities',async()=>{
 const good=input();assert.equal(boundary.validateVisualInput(good),true);
 for(const outputLocale of boundary.VISUAL_CONTRACT.outputLocales)assert.equal(boundary.validateVisualInput({...good,outputLocale}),true);
 for(const outputLocale of [null,[],{},'xx','en; publish'])assert.equal(boundary.validateVisualInput({...good,outputLocale}),false);
 for(const change of [{...good,sourceUrl:'https://private.example'},{...good,media:[{...good.media[0],sizeBytes:5000000}]},{...good,productRevision:'old'},{...good,media:new Array(1)},{...good,media:[{...good.media[0],frameIndex:1}]}])assert.equal(boundary.validateVisualInput(change),false);
 assert.equal((await adapter().execute({...good,capability:'publish-product'},'owner')).code,'unsupported-capability');
 const frames={...good,capability:'video-frame-semantics',media:[{...good.media[0],frameIndex:0,timestampSeconds:1}]};assert.equal(boundary.validateVisualInput(frames),true);assert.equal(boundary.validateVisualInput({...frames,media:Array.from({length:5},()=>frames.media[0])}),false);
});
test('untrusted output is restricted to evidence-backed suggestions and cannot mutate privileged fields',async()=>{
 assert.equal(boundary.validateVisualOutput(output(),input()),true);
 for(const proposal of [{...output().proposals[0],kind:'price'},{...output().proposals[0],confidence:0.9},{...output().proposals[0],evidence:['d'.repeat(64)]},{...output().proposals[0],value:'<script>bad</script>'},{...output().proposals[0],kind:'category',value:{categoryId:'999',sectorId:'1'}}])assert.equal(boundary.validateVisualOutput({...output(),proposals:[proposal]},input()),false);
 assert.equal((await adapter({runtime:{execute:async()=>({...output(),sql:'DROP TABLE'})}}).execute(input(),'owner')).code,'invalid-model-output');
});
test('scope and revisions are checked before execution and again before returning output',async()=>{
 let executions=0,checks=0;const runtime={execute:async()=>{executions++;return output();}};
 assert.equal((await adapter({runtime,authorize:async()=>false}).execute(input(),'foreign')).code,'scope-or-revision-rejected');assert.equal(executions,0);
 assert.equal((await adapter({runtime,authorize:async()=>++checks===1}).execute(input(),'owner')).code,'scope-or-revision-rejected');assert.equal(executions,1);
});
test('validated fixture result carries scope/provenance and review never changes a product',async()=>{
 const result=await adapter().execute(input(),'owner');assert.equal(result.status,'succeeded');assert.equal(result.validation,'schema-valid-unverified');assert.equal(result.provenance.operator,'DEMEOS');assert.equal(result.resourceUsage.executions,1);
 const proposal=result.proposals[0],review={actor:'owner',businessId:'visual-shop',productId:'p1',productRevision:input().productRevision,decision:'edited',value:'Vendor description'};
 assert.equal(boundary.reviewProposal(proposal,review).review.value,'Vendor description');assert.equal(proposal.review.state,'pending');
 for(const change of [{productRevision:'old'},{businessId:'foreign'},{decision:'publish'},{value:'x'.repeat(2001)}])assert.throws(()=>boundary.reviewProposal(proposal,{...review,...change}));
 assert.equal(boundary.reviewProposal(proposal,{...review,decision:'rejected'}).review.state,'rejected');
});
test('transient retries are bounded and errors never include runtime secrets',async()=>{
 let n=0;const result=await adapter({runtime:{execute:async()=>{n++;throw Object.assign(Error('private-secret'),{code:'TRANSIENT'});}}}).execute(input(),'owner');
 assert.equal(n,2);assert.equal(result.resourceUsage.retries,1);assert.equal(JSON.stringify(result).includes('private-secret'),false);
});
test('deadline aborts a hung runtime and prevents overlapping jobs after timeout',async()=>{
 let observed;const a=adapter({runtime:{execute:async({signal})=>{observed=signal;return new Promise(()=>{});}}});
 const result=await a.execute(input(),'owner');assert.equal(result.code,'execution-timeout');assert.equal(observed.aborted,true);assert.equal((await a.execute(input(),'owner')).code,'runtime-busy');
});
test('durable SQL ledger enforces ownership, deduplication, cache reuse and budgets',async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=createPersistenceRepository(db);
 try{
  await repo.createBusinessForOwner('owner',{businessId:'visual-shop',name:'Fixture',products:[]});
  const ledger=createModelLedger(db),request={identity:'owner',input:input(),inputHash:'e'.repeat(64),limits:boundary.VISUAL_CONTRACT.limits};
  assert.equal((await ledger.claim({...request,identity:'foreign'})).status,'limited');
  const [a,b]=await Promise.all([ledger.claim(request),ledger.claim(request)]);assert.deepEqual([a.status,b.status].sort(),['claimed','limited']);
  const claim=[a,b].find(v=>v.status==='claimed');
  await ledger.finish({...claim,inputHash:request.inputHash,result:{status:'succeeded',provenance:{},output:output()}});
  assert.equal((await ledger.claim(request)).status,'cached');
  await client.query('UPDATE demeos_visual_execution_slots SET jobs=20');
  assert.equal((await ledger.claim({...request,inputHash:'f'.repeat(64)})).status,'limited');
  assert.equal((await client.query('SELECT count(*)::integer n FROM demeos_visual_execution_events')).rows[0].n,1);
  assert.equal((await ledger.claim({...request,identity:'foreign'})).status,'limited');
 }finally{await client.close();}
});
test('actual decoded bytes produce a persisted SHA256 and corrupted images fail closed',async()=>{
 const sharp=require('sharp'),{createSharpMediaDrivers}=require('../api/_lib/media-sharp-driver'),{normalizeProcessingResult}=require('../api/_lib/media-processing-result'),{normalizeMediaAsset}=require('../api/_lib/media-asset-contract');
 const bytes=await sharp({create:{width:40,height:30,channels:3,background:'#123456'}}).png().toBuffer();
 const drivers=createSharpMediaDrivers({fetchImpl:async()=>new Response(bytes)}),asset={assetId:'img',businessId:'b',kind:'image',state:'processing',contentType:'image/png',sizeBytes:bytes.length};
 const data=await drivers.inspectImage(asset,{sourceUrl:'https://private.test/source'});assert.equal(data.sourceHash,require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
 const result=normalizeProcessingResult(asset,{success:true,storageKey:'processed',deliveryUrl:'https://private.test/image',...data});assert.equal(normalizeMediaAsset({...asset,...result},'b').sourceHash,data.sourceHash);
 const images=['img','second'].map(assetId=>({...asset,...data,assetId,state:'ready',relatedEntityId:'p',purpose:'product',processedStorageKey:'businesses/b/media/'+assetId+'/processed/master.webp'}));
 const duplicates=require('../api/_lib/selling-native-intelligence').mediaAnalysis({productId:'p',mediaGallery:{assetIds:['img','second'],mainAssetId:'img'}},images,'b');assert.ok(duplicates.some(f=>f.ruleId==='media-duplicate'&&f.field==='media.second'));
 assert.equal(require('../api/_lib/selling-native-intelligence').mediaAnalysis({productId:'p',mediaGallery:{assetIds:['img'],mainAssetId:'img'}},[images[0]],'b').some(f=>f.ruleId==='media-duplicate'),false);
 assert.equal(normalizeProcessingResult(asset,{success:true,storageKey:'processed',deliveryUrl:'https://private.test/image',...data,sourceHash:'fake'}),null);
 await assert.rejects(createSharpMediaDrivers({fetchImpl:async()=>new Response(Buffer.from('bad'))}).inspectImage({...asset,sizeBytes:3},{sourceUrl:'https://private.test/bad'}));
});
test('visual authorizer binds ready image bytes, revisions and product ownership to SQL state',async()=>{
 const client=new PGlite(),repo=createPersistenceRepository(createDatabase(client));
 const readiness=require('../api/_lib/selling-visual-readiness'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
 try{
  await repo.createBusinessForOwner('owner',{businessId:'visual-shop',name:'Fixture',applicationAccess:{selling:true},products:[{businessId:'visual-shop',productId:'p1',name:'Fixture',mediaGallery:{assetIds:['image1'],mainAssetId:'image1'}}]});
  const product=(await repo.getKnownBusiness('visual-shop')).businessProfile.products[0];
  const asset={businessId:'visual-shop',assetId:'image1',relatedEntityId:'p1',purpose:'product',kind:'image',state:'ready',width:400,height:300,contentType:'image/png',sizeBytes:100,processedSizeBytes:100,processedHash:'c'.repeat(64),processedStorageKey:'businesses/visual-shop/media/image1/processed/master.webp'};
  await repo.saveBusinessMediaAsset('visual-shop',asset);
  const assets=await repo.getSellingIntelligenceMedia('owner','visual-shop',product);
  const request={...input(),productRevision:catalogueRevision(product),mediaRevision:readiness.mediaRevision(assets),media:[{...input().media[0],contentType:'image/webp'}]};
  const authorize=readiness.createVisualAuthorizer({store:repo,environment:()=>({VERCEL_ENV:'production'})});
  assert.equal(await authorize('owner',request),true);assert.equal(await authorize('foreign',request),false);
  for(const change of [{productRevision:'d'.repeat(64)},{mediaRevision:'d'.repeat(64)},{media:[{...request.media[0],contentHash:'d'.repeat(64)}]},{capability:'video-frame-semantics'}])assert.equal(await authorize('owner',{...request,...change}),false);
  const details=readiness.technicalDetails(product,assets,'visual-shop');assert.equal(details[0].aspectRatio,4/3);assert.equal(details[0].representation.status,'hash-verified-image');assert.equal(details[0].representation.embeddings,'unavailable');
  const samples=readiness.technicalDetails(product,[{...asset,kind:'video',durationSeconds:20}],asset.businessId)[0].samplingPlan;
  assert.equal(samples.timestampsSeconds.length,4);assert.equal(samples.status,'extraction-required');
 }finally{await client.close();}
});

test('visual unavailable copy covers all ten languages and Arabic RTL',()=>{
 const copy=require('../js/selling-dashboard-copy');
 assert.equal(copy.languages.length,10);assert.equal(copy.resolve('ar').direction,'rtl');
 for(const lang of copy.languages)assert.ok(copy.packs[lang.code]['Visual recognition is unavailable. No authorised model is deployed.']);
});
