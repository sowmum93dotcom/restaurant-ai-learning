'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
const stock=require('../api/_lib/vendor-inventory'),{copy,keys}=require('../js/vendor-inventory-copy'),{parseCsv,csvCell}=require('../js/vendor-inventory');
const profile={businessId:'vendor',name:'Vendor',type:'Shop',location:'London',brandVoice:'Clear',targetCustomer:'Customers',goal:'Sell',preparationModel:'selling',profileVersion:3,offeringCategoryId:'fashion.apparel',productsServices:'Clothing',customerContinuation:{routes:['website'],website:'https://example.com'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'available'},products:[{businessId:'vendor',productId:'shirt',name:'Shirt',description:'Cotton shirt',price:'25 GBP',priceMode:'fixed',continuationRoute:'website',availability:'available',presentation:{version:1,categoryId:'fashion.apparel',kind:'product',pricing:{mode:'fixed',amount:25,currency:'GBP'},options:[{key:'size',values:[{value:'M',label:'Medium'},{value:'L',label:'Large'}]}],variants:[{variantId:'medium',selection:{size:'M'},availability:'available',pricing:{mode:'fixed',amount:25,currency:'GBP'}},{variantId:'large',selection:{size:'L'},availability:'available',pricing:{mode:'fixed',amount:25,currency:'GBP'}}]}}]};
const change=(variantId='medium',onHand=10,sku=variantId)=>({productId:'shirt',variantId,onHand,lowStock:3,sku,reason:'Initial count'});
test('exact variants stay isolated; no guessed option combinations or service unit stock',()=>{
 const update=stock.applyChanges(profile,{},[change()]);const rows=stock.rowsFor(profile,update.entries);assert.equal(rows[0].available,10);assert.equal(rows[1].onHand,null);
 assert.throws(()=>stock.applyChanges(profile,{},[{...change(),variantId:'unknown'}]));
 assert.deepEqual(stock.rowsFor({...profile,products:[{...profile.products[0],presentation:{...profile.products[0].presentation,variants:[]}}]}),[]);
 assert.deepEqual(stock.rowsFor({...profile,products:[{...profile.products[0],presentation:{kind:'service'}}]}),[]);
});
test('recorded stock cannot move when an exact variant is redefined',()=>{
 const update=stock.applyChanges(profile,{},[change()]);
 const changed=structuredClone(profile);changed.products[0].presentation.variants[0].selection.size='L';
 const row=stock.rowsFor(changed,update.entries)[0];assert.equal(row.blocked,true);assert.equal(row.onHand,null);
 assert.throws(()=>stock.applyChanges(changed,update.entries,[change()]));
 const renamed=structuredClone(profile);renamed.products[0].name='New shirt name';
 assert.equal(stock.rowsFor(renamed,update.entries)[0].onHand,10);
});
test('quantities, unique codes, reserved units and batch size are protected',()=>{
 for(const onHand of [-1,1.5,NaN,Infinity,'1',1000000001])assert.throws(()=>stock.applyChanges(profile,{},[change('medium',onHand)]));
 assert.throws(()=>stock.applyChanges(profile,{},[change('medium',2,'same'),change('large',5,'SAME')]));
 assert.throws(()=>stock.applyChanges(profile,{[stock.key('shirt','medium')]:{onHand:5,reserved:3}},[change('medium',2)]));
 assert.throws(()=>stock.applyChanges(profile,{},[{...change(),reserved:2}]));
 assert.throws(()=>stock.applyChanges(profile,{},[{...change(),reason:''}]));
 assert.throws(()=>stock.applyChanges(profile,{},Array(101).fill(change())));
});
test('CSV quoting round trips and guards spreadsheet formula injection',()=>{
 const rows=[['productId','variantId','onHand','lowStock','sku'],['a,"b','medium',4,2,'=BAD()']];const text=rows.map(r=>r.map(csvCell).join(',')).join('\r\n');assert.deepEqual(parseCsv(text),[['productId','variantId','onHand','lowStock','sku'],['a,"b','medium','4','2',"'=BAD()"]]);assert.throws(()=>parseCsv('"open'));
});
test('all nine languages cover every inventory label',()=>{assert.equal(Object.keys(copy).length,9);for(const language of Object.values(copy))for(const key of keys)assert.equal(typeof language[key],'string',key);});
test('real SQL atomically records stock, history, ownership and revisions',async()=>{
 const dbClient=new PGlite(),database=createDatabase(dbClient),repository=persistence.createPersistenceRepository(database);
 try{await repository.createBusinessForOwner('owner',profile);
  const update=stock.applyChanges(profile,{},[change()]);
  assert.equal(await repository.saveVendorInventory('other','vendor',profile,0,update.entries,update.audit),null);
  const first=await repository.saveVendorInventory('owner','vendor',profile,0,update.entries,update.audit);assert.equal(first.revision,1);
  assert.equal(await repository.saveVendorInventory('owner','vendor',profile,0,update.entries,update.audit),null);
  const inventory=await repository.getVendorInventory('vendor');assert.equal(inventory.history.length,1);assert.equal(inventory.entries[stock.key('shirt','medium')].onHand,10);
  const next=stock.applyChanges(profile,inventory.entries,[change('medium',3)]);assert.equal((await repository.saveVendorInventory('owner','vendor',profile,1,next.entries,next.audit)).revision,2);
  const competing=await Promise.all([repository.saveVendorInventory('owner','vendor',profile,2,next.entries,next.audit),repository.saveVendorInventory('owner','vendor',profile,2,next.entries,next.audit)]);assert.equal(competing.filter(Boolean).length,1);
  await repository.saveBusiness({...profile,preparationModel:'marketing'});
  assert.equal(await repository.saveVendorInventory('owner','vendor',profile,2,next.entries,next.audit),null);
  assert.equal((await repository.getVendorInventory('vendor')).history.length,3);
 }finally{await dbClient.close();}
});
test('owner APIs deny unauthenticated, foreign and marketing access; product saves use optimistic concurrency',async()=>{
 const dbClient=new PGlite(),repository=persistence.createPersistenceRepository(createDatabase(dbClient));
 const priorRepo=persistence.getRepository,priorAuth=auth.resolveTrustedIdentityFromRequest;persistence.getRepository=()=>repository;auth.resolveTrustedIdentityFromRequest=async req=>req.identity?{trustedIdentityId:req.identity}:null;
 const modules=['../api/_lib/demeos-business-owner-authorization','../api/businesses/[businessId]/inventory','../api/businesses/[businessId]/products'];for(const module of modules)delete require.cache[require.resolve(module)];
 const inventory=require(modules[1]),products=require(modules[2]);
 async function call(handler,identity,method='GET',body={}){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};await handler({identity,method,query:{businessId:'vendor'},body},res);return res;}
 try{await repository.createBusinessForOwner('owner',profile);
  assert.equal((await call(inventory,null)).code,401);assert.equal((await call(inventory,'stranger')).code,403);
  const loaded=await call(inventory,'owner');assert.equal(loaded.code,200);assert.equal(loaded.data.sellingEnabled,false);
  assert.equal((await call(inventory,'owner','PUT',{revision:0,catalogueRevision:loaded.data.catalogueRevision,changes:[change()]})).code,200);
  assert.equal((await call(inventory,'owner','PUT',{revision:0,catalogueRevision:loaded.data.catalogueRevision,changes:[change()]})).code,409);
  const catalog=await call(products,'owner');const changed=structuredClone(catalog.data.products);changed[0].description='Updated cotton shirt';
  assert.equal((await call(products,'owner','PUT',{catalogueRevision:catalog.data.catalogueRevision,products:changed,accuracyConfirmed:true})).code,200);
  assert.equal((await call(products,'owner','PUT',{catalogueRevision:catalog.data.catalogueRevision,products:changed,accuracyConfirmed:true})).code,409);
  assert.equal((await repository.getKnownBusiness('vendor')).businessProfile.products[0].presentation.variants[0].variantId,'medium');
  const reassigned=await call(products,'owner');const wrongVariant=structuredClone(reassigned.data.products);wrongVariant[0].presentation.variants[0].selection.size='L';wrongVariant[0].presentation.variants[1].selection.size='M';
  assert.equal((await call(products,'owner','PUT',{catalogueRevision:reassigned.data.catalogueRevision,products:wrongVariant,accuracyConfirmed:true})).code,409);
  const fresh=await call(products,'owner');const productWithGallery=structuredClone(fresh.data.products);
  await repository.saveBusinessMediaAsset('vendor',{businessId:'vendor',assetId:'matching',relatedEntityId:'shirt',kind:'image',state:'ready'});
  await repository.saveBusinessMediaAsset('vendor',{businessId:'vendor',assetId:'wrong-product',relatedEntityId:'another-shirt',kind:'image',state:'ready'});
  productWithGallery[0].mediaGallery={assetIds:['wrong-product'],mainAssetId:'wrong-product'};
  assert.equal((await call(products,'owner','PUT',{catalogueRevision:fresh.data.catalogueRevision,products:productWithGallery,accuracyConfirmed:true})).code,400);
  productWithGallery[0].mediaGallery={assetIds:['matching'],mainAssetId:'matching'};
  assert.equal((await call(products,'owner','PUT',{catalogueRevision:fresh.data.catalogueRevision,products:productWithGallery,accuracyConfirmed:true})).code,200);
  assert.deepEqual((await repository.getKnownBusiness('vendor')).businessProfile.products[0].mediaGallery,{assetIds:['matching'],mainAssetId:'matching'});
  await repository.saveBusiness({...profile,preparationModel:'marketing'});assert.equal((await call(inventory,'owner')).code,403);
 }finally{persistence.getRepository=priorRepo;auth.resolveTrustedIdentityFromRequest=priorAuth;for(const module of modules)delete require.cache[require.resolve(module)];await dbClient.close();}
});
