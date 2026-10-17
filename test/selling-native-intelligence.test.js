'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const native=require('../api/_lib/selling-native-intelligence'),registry=require('../api/_lib/marketing-agent-categories');
const fields=require('../api/_lib/selling-category-fields'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard');
const environment={VERCEL_ENV:'production'},identity='owner';
const reference=id=>({categoryId:id,sectorId:registry.getCategory(id).sectorId,datasetVersion:registry.DATASET_VERSION});
const product=(extra={})=>({businessId:'intelligence-shop',productId:'a',name:registry.getCategory('11').categoryName,sku:'CAM-1',description:'A camera',classification:reference('11'),categoryAttributes:{schemaVersion:1,byCategory:{'11':{model:'Camera',specifications:'24 MP'}}},priceMode:'fixed',price:'10',availability:'contact',...extra});
const profile=p=>({businessId:'intelligence-shop',name:'Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[p]});
const input=(p,extra={})=>({profile:profile(p),product:p,assets:[],stock:{revision:0,entries:{},history:[]},environment,identity,...extra});
const asset=(extra={})=>{const prefix='businesses/intelligence-shop/media/img/';return {assetId:'img',businessId:'intelligence-shop',relatedEntityId:'a',purpose:'product',kind:'image',state:'ready',width:1500,height:1000,sizeBytes:1000,contentType:'image/jpeg',storageKey:prefix+'original.jpg',processedStorageKey:prefix+'processed/customer.jpg',derivatives:['customer','thumbnail','marketing'].map(role=>({role,storageKey:prefix+'processed/'+role+'.jpg',contentType:'image/jpeg'})),...extra};};
test('native classification reuses all 171 stable references and existing negation rules',()=>{
 assert.equal(registry.SECTORS.length,9);assert.equal(registry.CATEGORIES.length,171);
 for(const c of registry.CATEGORIES){const result=native.classify({name:c.categoryName});assert.ok(result.candidates.some(r=>r.categoryId===c.categoryId));assert.ok(result.candidates.every(r=>registry.getCategory(r.categoryId)));}
 const name=registry.getCategory('11').categoryName;
 assert.deepEqual(native.classify({name:'Not '+name}).candidates,[]);
 assert.equal(native.classify({name:'Not only '+name}).outcome,'rules-supported');
 assert.equal(native.classify({name,classification:reference('10')}).outcome,'conflicting-information');
 assert.equal(native.classify({name:'Handmade useful item'}).outcome,'insufficient-information');
 assert.equal(native.classify({name,classification:{categoryId:'172'}}).outcome,'unsupported');
 assert.equal(native.classify({name,description:'x'.repeat(501)}).outcome,'unsupported');
 const two=native.classify({name:name+'; '+registry.getCategory('10').categoryName});assert.equal(two.outcome,'plausible-candidate');assert.equal('confidence' in two,false);
});
test('completeness explains incomplete drafts and required category fields without approving',()=>{
 const p=product({name:'',description:'',price:'-1',categoryAttributes:null});const result=native.analyze(input(p));
 for(const id of ['title-required','description-required','category-attribute','price-invalid','main-image'])assert.ok(result.findings.some(f=>f.ruleId===id&&f.status==='failed'),id);
 assert.equal(result.readiness,'incomplete-draft');assert.equal(result.publicationPermitted,false);
 for(const f of result.findings)for(const key of ['ruleId','severity','field','explanation','suggestedCorrection','status'])assert.ok(f[key]);
 for(const c of ['9','10','11','39','81'])for(const f of fields.definition(c).fields){assert.equal(f.type,'string');assert.ok(f.validation.maxLength);assert.ok(f.labelKey);assert.ok(f.helpTextKey);}
 assert.deepEqual(fields.definition('1').fields,[]);
});
test('duplicates remain bounded and private to the authorised business',()=>{
 const p=product(),rows=Array.from({length:100},(_,i)=>product({productId:'p'+i}));
 const result=native.duplicates(p,[product({businessId:'other',productId:'secret'}),...rows],p.businessId);
 assert.equal(result.length,25);assert.ok(result.every(r=>r.productId!=='secret'&&r.signals.includes('same-sku')));
 assert.equal(native.duplicates(p,[product({productId:'b',sku:'different',name:'Different'})],p.businessId).length,0);
});
test('image and video findings use genuine metadata, relationships and private derivatives',()=>{
 const p=product({mediaGallery:{assetIds:['img'],mainAssetId:'img'}});
 let result=native.analyze(input(p,{assets:[asset()]}));assert.equal(result.readiness,'ready-for-vendor-review');
 result=native.analyze(input(p,{assets:[asset({width:800})]}));assert.ok(result.findings.some(f=>f.ruleId==='image-quality'));
 for(const bad of [asset({businessId:'other'}),asset({relatedEntityId:'wrong'}),asset({state:'failed'}),asset({contentType:'image/gif'}),asset({sizeBytes:0})])assert.ok(native.analyze(input(p,{assets:[bad]})).findings.some(f=>f.status!=='passed'&&f.severity==='error'));
 const prefix='businesses/intelligence-shop/media/vid/processed/';const video=asset({assetId:'vid',kind:'video',contentType:'video/quicktime',durationSeconds:20,processedStorageKey:prefix+'customer.mp4',derivatives:[{role:'customer',storageKey:prefix+'customer.mp4',contentType:'video/mp4'}]});
 const checks=native.mediaAnalysis(p,[asset(),video],p.businessId);
 assert.ok(checks.some(f=>f.ruleId==='video-playback'&&f.status==='passed'));assert.ok(checks.some(f=>f.ruleId==='video-cover'&&f.status==='unavailable'));
 assert.ok(native.mediaAnalysis(p,[{...video,durationSeconds:61}],p.businessId).some(f=>f.ruleId==='media-properties'&&f.status==='failed'));
 assert.ok(native.mediaAnalysis({...p,mediaGallery:{assetIds:['img','img']}},[asset()],p.businessId).some(f=>f.ruleId==='media-duplicate'));
 assert.ok(native.mediaAnalysis(p,Array.from({length:65},(_,i)=>asset({assetId:'i'+i})),p.businessId).some(f=>f.ruleId==='media-limit'));
});
test('hash invalidates product, stock, category rules, media and duplicate context; review-required stays held',()=>{
 const p=product(),a=input(p),hash=native.fingerprint(a);
 for(const changed of [{...a,product:{...p,description:'Changed'}},{...a,stock:{revision:1}},{...a,assets:[asset()]},{...a,profile:{...a.profile,name:'Changed'}}])assert.notEqual(native.fingerprint(changed),hash);
 assert.equal(native.analyze(input(product({submission:{state:'review-required'}}))).readiness,'held');
 assert.equal(native.analyze(input(product({submission:{state:'approved'}}))).readiness,'held');
 assert.throws(()=>native.analyze(input(product({businessId:'other'}))));
});
test('self-hosted boundary stays unavailable and never fabricates output',async()=>{
 const model=require('../api/_lib/selling-model-boundary');assert.equal(model.availability().available,false);assert.equal((await model.execute({endpoint:'https://untrusted.example'})).output,null);assert.equal(model.validateResult({modelId:'fake'}),false);
});
test('native intelligence HTTP API persists in SQL, reuses cache, audits review and rejects stale/cross-tenant writes',async()=>{
 const client=new PGlite(),repo=createPersistenceRepository(createDatabase(client));
 try{
 let p=product();await repo.createBusinessForOwner(identity,profile(p));p=(await repo.getKnownBusiness(p.businessId)).businessProfile.products[0];await repo.createBusinessForOwner('other-owner',{...profile(product({businessId:'other-shop'})),businessId:'other-shop'});
 const handler=createHandler({authenticate:async req=>req.identity===null?null:{trustedIdentityId:req.identity||identity},repository:()=>repo,environment:()=>environment});
 async function call(body={},who=identity,businessId=p.businessId){const res={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await handler({method:'POST',identity:who,query:{businessId},body:{action:'analyze-product',productId:p.productId,productRevision:catalogueRevision(p),...body}},res);return res;}
 let first=await call();assert.equal(first.code,200,JSON.stringify(first.body));assert.equal(first.body.persisted,true);assert.equal(first.body.cacheHit,false);
 let second=await call();assert.equal(second.body.cacheHit,true);assert.equal(second.body.analysis.analyzedAt,first.body.analysis.analyzedAt);
 const review=await call({action:'review-intelligence',inputHash:first.body.analysis.inputHash,confirmed:true});assert.equal(review.code,200);assert.equal(review.body.analysis.review.actions[0].actor,identity);
 assert.equal((await call()).body.analysis.review.status,'reviewed');
 assert.equal((await call({},'other-owner')).code,403);assert.equal((await call({},null)).code,401);
 assert.equal((await call({productId:'other-product'})).code,404);assert.equal((await call({productRevision:'old'})).code,409);
 assert.equal(await repo.getSellingIntelligence('other-owner',p.businessId,p.productId,first.body.analysis.inputHash),null);
 assert.deepEqual(await repo.getSellingIntelligenceMedia('other-owner',p.businessId,p),[]);
 const current=(await repo.getKnownBusiness(p.businessId)).businessProfile;
 await repo.saveBusiness({...current,name:'Changed context'});
 assert.equal((await call({action:'review-intelligence',inputHash:first.body.analysis.inputHash,confirmed:true})).code,409);
 assert.equal((await call()).body.cacheHit,false);
 const fresh=(await repo.getKnownBusiness(p.businessId)).businessProfile;
 assert.equal(await repo.saveSellingIntelligence('other-owner',fresh,p,[],{revision:0},first.body.analysis),null);
 assert.equal(await repo.saveSellingIntelligence(identity,current,p,[],{revision:0},first.body.analysis),null,'Stale profile cannot write cached results');
 const editor={name:p.name,description:p.description,sku:p.sku,price:p.price,priceMode:p.priceMode,availability:p.availability,classification:p.classification,categoryFields:{categoryId:'11',datasetVersion:registry.DATASET_VERSION,schemaVersion:1,values:p.categoryAttributes.byCategory['11']}};
 assert.equal((await call({editor})).body.persisted,true,'Unchanged editor reopens saved analysis');
 const unsaved=await call({editor:{...editor,name:'Changed title'}});assert.equal(unsaved.body.persisted,false);
 assert.equal((await repo.getKnownBusiness(p.businessId)).businessProfile.products[0].name,p.name,'Assistance never overwrites product');
 const forbidden=await call({editor:{...editor,mediaGallery:{assetIds:['secret']}}});assert.equal(forbidden.code,400);
 assert.equal((await call({editor:{...editor,classification:{categoryId:'999'}}})).code,400);
 assert.equal((await call({action:'review-intelligence',inputHash:first.body.analysis.inputHash,confirmed:false})).code,409);
 }finally{await client.close();}
});
test('all intelligence controls, explanations and outcomes have ten-language copy and Arabic RTL',()=>{
 const fs=require('node:fs'),copy=require('../js/selling-dashboard-copy'),source=fs.readFileSync(require.resolve('../js/selling-dashboard.js'),'utf8');
 const rules=source.slice(source.indexOf('const intelligenceMessages='),source.indexOf('function clearIntelligence'));
 const messages=[...rules.matchAll(/:'([^']+)'/g)].map(m=>m[1]);
 const keys=['Improve with DEMEOS Intelligence','Suggestions require your review. Analysis does not approve publication.','Analyse product','Analysing product…','Current saved analysis reused.','Mark findings reviewed','Use suggested category',...messages];
 assert.equal(copy.languages.length,10);assert.equal(copy.resolve('ar').direction,'rtl');
 for(const lang of copy.languages)for(const key of keys)assert.ok(copy.packs[lang.code][key],lang.code+': '+key);
});
