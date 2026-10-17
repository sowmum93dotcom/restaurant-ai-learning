'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const catalogue=require('../api/_lib/selling-catalogue');
const {createHandler}=require('../api/_lib/selling-dashboard');
const {catalogueRevision}=require('../api/_lib/vendor-inventory');
const env={VERCEL_ENV:'production'};
const response=()=>({setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
test('catalogue query rejects arrays, invalid states, unknown categories and SQL sort injection',()=>{
 for(const query of [{q:['a']},{category:'999'},{state:'active'},{sort:'price; DROP TABLE demeos_businesses'},{offset:'-1'},{offset:'100001'},{snapshot:'wrong'},{validation:'approved'}])assert.throws(()=>catalogue.parse(query));
 assert.equal(catalogue.parse().limit,25);
});
test('SQL catalogue search, filters, stable pages, literal search, isolation and stale snapshot',async()=>{
 const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db));
 const product=i=>({productId:'p-'+String(i).padStart(4,'0'),businessId:'shop-a',name:i===7?'Literal %_ tea':'Tea '+String(i).padStart(4,'0'),sku:'SKU-'+i,description:'Saved tea',priceMode:'fixed',price:String(i),availability:i%2?'available':'unavailable',classification:{categoryId:i%2?'1':'2',sectorId:'1',datasetVersion:'marketing-agent-categories-v1'},submission:{state:i%3?'draft':'changes-required',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}});
 const profile={businessId:'shop-a',name:'Shop A',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:Array.from({length:61},(_,i)=>product(i))};
 try{
 await repo.createBusinessForOwner('owner-a',profile);await repo.saveBusiness(profile);await repo.createBusinessForOwner('owner-b',{...profile,businessId:'shop-b',products:[{...product(200),businessId:'shop-b'}]});
 const handler=createHandler({authenticate:async req=>({trustedIdentityId:req.identity||'owner-a'}),repository:()=>repo,environment:()=>env});
 async function read(query={},identity){const res=response();await handler({method:'GET',identity,query:{businessId:'shop-a',view:'catalogue',...query}},res);assert.equal(res.code,200,JSON.stringify(res.body));return res.body.business;}
 const first=await read({sort:'name'});assert.equal(first.products.length,25);assert.equal(first.cataloguePage.total,61);assert.equal(first.summary.products,61);assert.equal(first.cataloguePage.hasNext,true);
 const second=await read({sort:'name',offset:'25',snapshot:first.cataloguePage.snapshot});const last=await read({sort:'name',offset:'50',snapshot:first.cataloguePage.snapshot});
 assert.equal(new Set([...first.products,...second.products,...last.products].map(p=>p.productId)).size,61);assert.equal(last.cataloguePage.hasNext,false);
 assert.equal((await read({q:'SKU-17'})).products[0].productId,'p-0017');assert.equal((await read({q:'p-0031'})).products[0].productId,'p-0031');assert.equal((await read({q:'%_'})).cataloguePage.total,1);assert.equal((await read({q:'marketplace stores'})).cataloguePage.total,30);
 assert.ok((await read({category:'1',state:'draft',availability:'available'})).products.every(p=>p.classification.categoryId==='1'&&p.submission.state==='draft'&&p.availability==='available'));
 assert.equal((await read({sort:'price'})).products[0].price,'0');assert.equal((await read({validation:'not-checked'})).cataloguePage.total,61);assert.equal((await read({validation:'failed'})).cataloguePage.total,0);
 assert.equal((await read({stock:'untracked'})).cataloguePage.total,61);
 const denied=response();await handler({method:'GET',identity:'owner-b',query:{businessId:'shop-a',view:'catalogue'}},denied);assert.equal(denied.code,403);
 const direct=await repo.getSellingCataloguePage({identity:'owner-b',businessId:'shop-a',profile,query:catalogue.parse(),stock:{}});assert.equal(direct.current,false);assert.equal(direct.products.length,0);
 const fresh=(await repo.getKnownBusiness('shop-a')).businessProfile;await repo.saveBusiness({...fresh,name:'Changed'});
 const stale=response();await handler({method:'GET',query:{businessId:'shop-a',view:'catalogue',sort:'name',offset:'25',snapshot:first.cataloguePage.snapshot}},stale);assert.equal(stale.code,409);assert.equal(stale.body.code,'catalogue-snapshot');
 }finally{await db.close();}
});
test('catalogue snapshot binds filters, profile revision and inventory revision',()=>{
 const query=catalogue.parse();const snapshot=catalogue.snapshot('a',1,query);
 assert.equal(catalogue.snapshot('a',1,{...query,offset:25,snapshot}),snapshot);
 for(const args of [['b',1,query],['a',2,query],['a',1,{...query,q:'x'}]])assert.notEqual(catalogue.snapshot(...args),snapshot);
});
test('catalogue copy covers every established Selling language',()=>{
 const copy=require('../js/selling-dashboard-copy');for(const lang of copy.languages)for(const key of ['All categories','All statuses','All checks','Sort by','Next page','Previous page','Unsaved product recovered. Review before saving.','Discard unsaved product changes?'])assert.ok(copy.packs[lang.code][key],lang.code+': '+key);
});

test('category attributes use registry IDs, enforce required values and preserve earlier category data',()=>{
 const fields=require('../api/_lib/selling-category-fields'),registry=require('../api/_lib/marketing-agent-categories');
 assert.equal(fields.definition('999'),null);assert.equal(registry.CATEGORIES.length,171);
 const reference=id=>({categoryId:id,sectorId:'1',datasetVersion:registry.DATASET_VERSION});
 const input=(id,values)=>({schemaVersion:1,categoryId:id,datasetVersion:registry.DATASET_VERSION,values});
 assert.throws(()=>fields.apply(null,reference('11'),input('11',{model:'Camera'})));
 const incomplete=fields.apply(null,reference('11'),input('11',{model:'Camera'}),{draft:true});
 assert.equal(fields.ready({classification:reference('11'),categoryAttributes:incomplete}),false);
 const electronics=fields.apply(incomplete,reference('11'),input('11',{model:'Camera',specifications:'24 MP'}));
 const apparel=fields.apply(electronics,reference('10'),input('10',{material:'Cotton'}));
 assert.equal(apparel.byCategory['11'].specifications,'24 MP');assert.equal(apparel.byCategory['10'].material,'Cotton');
 for(const invalid of [input('10',{material:'x',unknown:'y'}),{...input('10',{}),schemaVersion:2},input('11',{material:'x'}),input('10',{material:42})])assert.throws(()=>fields.apply(apparel,reference('10'),invalid));
});

test('bulk availability uses real SQL, rejects cross-business selections and preserves reservations',async()=>{
 const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db));
 const product=(id,sku)=>({businessId:'bulk-shop',productId:id,name:id,sku,description:'A product',priceMode:'contact',price:'',availability:'contact'});
 const profile={businessId:'bulk-shop',name:'Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[product('a','A'),product('b','B')]};
 try{
 await repo.createBusinessForOwner('owner-a',profile);
 const handler=createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),repository:()=>repo,environment:()=>env});
 async function call(body){const current=(await repo.getKnownBusiness('bulk-shop')).businessProfile,res=response();await handler({method:'POST',query:{businessId:'bulk-shop'},body:{action:'bulk-availability',confirmed:true,catalogueRevision:catalogueRevision(current),availability:'limited',productIds:['a','b'],...body}},res);return res;}
 assert.equal((await call({productIds:['a','foreign']})).code,404);assert.equal((await call({confirmed:false})).code,400);assert.equal((await call({productIds:['a','a']})).code,400);assert.equal((await call({catalogueRevision:'stale'})).code,409);
 assert.equal((await call({})).code,200);const saved=(await repo.getKnownBusiness('bulk-shop')).businessProfile;assert.ok(saved.products.every(p=>p.availability==='limited'&&p.submission.state==='draft'&&p.customerVisible===false));
 const inventory=require('../api/_lib/vendor-inventory'),change=inventory.applyChanges(saved,{},[{productId:'a',variantId:'',onHand:0,lowStock:2,sku:'A',reason:'Counted'}]);await repo.saveVendorInventory('owner-a','bulk-shop',saved,0,change.entries,change.audit);
 const stockBefore=await repo.getVendorInventory('bulk-shop');
 const threshold={action:'adjust-stock',inventoryRevision:stockBefore.revision,product:{productId:'a',variantId:'',quantity:0,lowStock:9,note:'Updated reorder threshold'}};
 assert.equal((await call(threshold)).code,200);const thresholdSaved=await repo.getVendorInventory('bulk-shop');assert.equal(thresholdSaved.entries[inventory.key('a','')].lowStock,9);assert.equal(thresholdSaved.history[0].changes[0].reason,'Updated reorder threshold');assert.equal((await call(threshold)).code,409,'Retry cannot duplicate an adjustment');
 assert.equal((await call({availability:'available'})).code,409);assert.equal((await repo.getKnownBusiness('bulk-shop')).businessProfile.products[0].availability,'limited');
 // A product SKU is business-scoped and cannot collide with another product.
 const clash=await call({action:'save-product',product:{...saved.products[1],sku:'A'}});assert.equal(clash.code,400);
 }finally{await db.close();}
});

test('product revision permits unrelated profile changes but rejects newer product content',async()=>{
 const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db));
 const profile={businessId:'revision-shop',name:'Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[{businessId:'revision-shop',productId:'p',name:'Original',description:'A product',priceMode:'contact',price:'',availability:'contact'}]};
 try{
 await repo.createBusinessForOwner('owner-a',profile);const before=(await repo.getKnownBusiness('revision-shop')).businessProfile;
 const revision=catalogueRevision(before.products[0]),base=catalogueRevision(before);await repo.saveBusiness({...before,location:'Manchester'});
 const handler=createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),repository:()=>repo,environment:()=>env});
 const call=async name=>{const res=response();await handler({method:'POST',query:{businessId:'revision-shop'},body:{action:'save-product',catalogueRevision:base,productRevision:revision,product:{productId:'p',name,description:'A product',priceMode:'contact',price:'',availability:'contact'}}},res);return res;};
 assert.equal((await call('Saved after profile edit')).code,200);const saved=(await repo.getKnownBusiness('revision-shop')).businessProfile;assert.equal(saved.location,'Manchester');assert.equal(saved.products[0].name,'Saved after profile edit');assert.equal((await call('Stale overwrite')).code,409);assert.equal((await repo.getKnownBusiness('revision-shop')).businessProfile.products[0].name,'Saved after profile edit');
 }finally{await db.close();}
});

test('private order keyset pages search genuine reservations and enforce ownership',async()=>{
 const db=new PGlite(),database=createDatabase(db),repo=createPersistenceRepository(database);
 const inventory=require('../api/_lib/vendor-inventory'),service=require('../api/_lib/vendor-orders').createVendorOrders(database,{authorizePurchase:()=>true});
 const profile={businessId:'orders-shop',name:'Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[{businessId:'orders-shop',productId:'toy',name:'Wooden toy',availability:'available',presentation:{version:1,categoryId:'family.toys',pricing:{mode:'fixed',currency:'GBP',amount:10},options:[],variants:[]}}]};
 try{
 await repo.createBusinessForOwner('owner-a',profile);const saved=(await repo.getKnownBusiness('orders-shop')).businessProfile;
 const change=inventory.applyChanges(saved,{},[{productId:'toy',variantId:'',onHand:100,lowStock:5,sku:'TOY',reason:'Initial count'}]);await repo.saveVendorInventory('owner-a','orders-shop',saved,0,change.entries,change.audit);
 const records=[];for(let i=0;i<53;i++)records.push(await service.reserve('customer-a','order-page-fixture-'+String(i).padStart(4,'0'),{businessId:'orders-shop',productId:'toy',variantId:'',selection:{},quantity:1,catalogueRevision:catalogueRevision(saved),stockIdentity:inventory.stockIdentity(saved.products[0])}));
 const orders=require('../api/_lib/selling-order-page');const page=cursor=>repo.getSellingOrderPage({identity:'owner-a',businessId:'orders-shop',query:orders.parse({orderCursor:cursor||''})});
 const a=await page(),b=await page(a.nextCursor),c=await page(b.nextCursor);assert.equal(a.total,53);assert.equal(a.orders.length,25);assert.equal(b.orders.length,25);assert.equal(c.orders.length,3);assert.equal(c.nextCursor,null);assert.equal(new Set([...a.orders,...b.orders,...c.orders].map(o=>o.id)).size,53);
 assert.equal((await repo.getSellingOrderPage({identity:'owner-b',businessId:'orders-shop',query:orders.parse()})).total,0);
 await service.release(records[0].id,'cancelled','customer-a');const filtered=await repo.getSellingOrderPage({identity:'owner-a',businessId:'orders-shop',query:orders.parse({orderState:'cancelled',q:'Wooden'})});assert.equal(filtered.total,1);assert.equal(filtered.orders[0].id,records[0].id);assert.equal(filtered.orders[0].remainingReserved,0);assert.equal(filtered.orders[0].customerId,undefined);
 for(const query of [{orderCursor:'bad'},{orderState:'paid'},{q:['x']}])assert.throws(()=>orders.parse(query));
 }finally{await db.close();}
});
