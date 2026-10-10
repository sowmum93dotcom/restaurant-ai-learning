'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),stock=require('../api/_lib/vendor-inventory'),{createVendorOrders}=require('../api/_lib/vendor-orders');
const profile={businessId:'vendor',name:'Vendor',preparationModel:'selling',products:[{businessId:'vendor',productId:'shirt',name:'Exact shirt',availability:'available',presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:20},options:[{key:'size',values:[{value:'M',label:'Medium'},{value:'L',label:'Large'}]}],variants:[{variantId:'medium',selection:{size:'M'},availability:'available',pricing:{mode:'fixed',currency:'GBP',amount:21.5}},{variantId:'large',selection:{size:'L'},availability:'available'}]}}]};
const request=(p=profile,variant='medium',quantity=2)=>({businessId:p.businessId,productId:'shirt',variantId:variant,selection:{size:variant==='medium'?'M':'L'},quantity,catalogueRevision:stock.catalogueRevision(p),stockIdentity:stock.stockIdentity(p.products[0],p.products[0].presentation.variants.find(v=>v.variantId===variant))});
async function fixture(work){const client=new PGlite(),db=createDatabase(client),repo=persistence.createPersistenceRepository(db),orders=createVendorOrders(db,{authorizePurchase:record=>record.businessProfile.preparationModel==='selling'});try{await repo.createBusinessForOwner('owner',profile);const update=stock.applyChanges(profile,{},['medium','large'].map(variantId=>({productId:'shirt',variantId,onHand:5,lowStock:1,sku:variantId,reason:'Isolated count'})));await repo.saveVendorInventory('owner','vendor',profile,0,update.entries,update.audit);const saved=(await repo.getKnownBusiness('vendor')).businessProfile;await work({client,db,repo,orders,request:(p=profile,v,q)=>request(p===profile?saved:p,v,q)});}finally{await client.close();}}
const rejected=(promise,reason)=>assert.rejects(promise,e=>e.reason===reason);
test('server identity, exact variant, frozen price and idempotency; test receipts cannot be orders',()=>fixture(async({orders,db,repo,request})=>{
 const first=await orders.reserve('customer','request-000000001',request());assert.equal(first.line.unitPriceMinor,2150);assert.equal(first.line.totalPriceMinor,4300);assert.deepEqual(first.line.selection,{size:'M'});assert.equal(first.source,'authoritative-catalogue');
 assert.deepEqual(await orders.reserve('customer','request-000000001',request()),first);
 await rejected(orders.reserve('customer','request-000000001',request(profile,'medium',1)),'idempotency-conflict');
 await rejected(orders.reserve('customer','request-000000002',{...request(),price:0}),'invalid-request');
 await rejected(orders.reserve('customer','request-000000002',{...request(),selection:{size:'L'}}),'selection-mismatch');
 await rejected(orders.reserve('customer','request-variant-003',{...request(),variantId:'wrong'}),'variant-unavailable');
 assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','large')].reserved,0);
 assert.equal((await db.query('SELECT * FROM demeos_vendor_order_events')).rows.length,1);
 assert.equal((await db.query('SELECT * FROM demeos_vendor_stock_history')).rows.length,2);
 const {createPaymentStore}=require('../api/_lib/customer-payment-store');const payment=createPaymentStore(db);await payment.reserve({id:'test-receipt',provider:'isolated',quote:{mode:'test',recipient:'business',customerId:'customer'}},'controlled-request');assert.equal((await repo.getVendorOrders('owner','vendor')).length,1);
 await rejected(orders.reserve('customer','request-000000003',{...request(),mode:'test',receipt:'test-receipt'}),'invalid-request');
 assert.deepEqual(await repo.getVendorOrders('other','vendor'),[]);assert.equal((await repo.getVendorOrders('owner','vendor'))[0].customerId,undefined);
}));
test('concurrent reservations cannot oversell; retries and manual counts preserve reservations',()=>fixture(async({orders,repo,request})=>{
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>orders.reserve('customer'+i,'request-00000000'+i,request(profile,'medium',1))));assert.equal(results.filter(r=>r.status==='fulfilled').length,5);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.reason==='insufficient-stock'));
 const current=await repo.getVendorInventory('vendor');assert.equal(current.entries[stock.key('shirt','medium')].reserved,5);assert.equal(current.history.length,6);
 assert.throws(()=>stock.applyChanges(profile,current.entries,[{productId:'shirt',variantId:'medium',onHand:4,lowStock:1,sku:'medium',reason:'Below reservations'}]),/reserved/);
 await rejected(orders.reserve('other','request-000000010',request()),'insufficient-stock');
}));
test('permissions, customer role, stale catalogue and stock signature fail closed',()=>fixture(async({orders,db,repo,request})=>{
 await rejected(createVendorOrders(db).reserve('customer','request-000000001',request()),'selling-not-authorised');
 await rejected(orders.reserve('owner','request-000000001',request()),'customer-only');
 await rejected(orders.reserve('customer','request-000000001',{...request(),catalogueRevision:'a'.repeat(64)}),'stale-catalogue');
 await rejected(orders.reserve('customer','request-stock-00002',{...request(),stockIdentity:'b'.repeat(64)}),'stale-stock-identity');
 await repo.saveBusiness({...profile,preparationModel:'marketing'});await rejected(orders.reserve('customer','request-marketing-3',request()),'selling-not-authorised');assert.deepEqual(await repo.getVendorOrders('owner','vendor'),[]);
 assert.equal((await db.query('SELECT * FROM demeos_vendor_order_events')).rows.length,0);
}));
test('cancellation and persisted expiry release exactly once; invalid and conflicting transitions denied',()=>fixture(async({orders,db,repo,request})=>{
 const first=await orders.reserve('customer','request-000000001',request());await rejected(orders.release(first.id,'cancelled','stranger'),'ownership-denied');await rejected(orders.release(first.id,'expired','customer'),'expiry-authority-required');await rejected(orders.release(first.id,'expired','reservation-expiry-worker'),'not-expired');
 const results=await Promise.all([orders.release(first.id,'cancelled','customer'),orders.release(first.id,'cancelled','customer')]);assert.deepEqual(results[0],results[1]);assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','medium')].reserved,0);assert.equal((await db.query('SELECT * FROM demeos_vendor_order_events')).rows.length,2);
 await rejected(orders.release(first.id,'expired','reservation-expiry-worker'),'invalid-transition');
 assert.deepEqual(await orders.reserve('customer','request-000000001',request()),first);
 const next=await orders.reserve('customer','request-000000002',request(profile,'large'));
 await db.query("UPDATE demeos_vendor_orders SET expires_at=NOW()-INTERVAL '1 minute',record=jsonb_set(record,'{expiresAt}',to_jsonb((NOW()-INTERVAL '1 minute')::text)) WHERE order_id=$1",[next.id]);
 assert.equal((await orders.expireDue()).length,1);assert.deepEqual(await orders.expireDue(),[]);assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','large')].reserved,0);
 await rejected(orders.release(next.id,'cancelled','customer'),'invalid-transition');
}));
test('history failure rolls the order and stock back atomically',()=>fixture(async({orders,db,repo,request})=>{
 await db.query("CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated history failure'; END $$");await db.query('CREATE TRIGGER history_failure BEFORE INSERT ON demeos_vendor_stock_history FOR EACH ROW EXECUTE FUNCTION reject_history()');
 await assert.rejects(orders.reserve('customer','request-000000001',request()),/isolated history failure/);
 assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','medium')].reserved,0);assert.equal((await db.query('SELECT * FROM demeos_vendor_orders')).rows.length,0);
}));
test('concurrent identical requests return one reservation and one history event',()=>fixture(async({orders,db,repo,request})=>{
 const results=await Promise.all(Array.from({length:5},()=>orders.reserve('customer','request-000000001',request())));for(const value of results)assert.deepEqual(value,results[0]);assert.equal((await db.query('SELECT * FROM demeos_vendor_orders')).rows.length,1);assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','medium')].reserved,2);
}));
test('saved availability, service pricing and precision are server enforced',()=>fixture(async({orders,repo,request})=>{
 let index=0;for(const edit of [p=>p.products[0].availability='unavailable',p=>p.products[0].presentation.variants[0].availability='unavailable',p=>p.products[0].presentation.variants[0].pricing={mode:'from',currency:'GBP',amount:5},p=>p.products[0].presentation.variants[0].pricing.amount=1.001]){
  const p=structuredClone(profile);edit(p);await repo.saveBusiness(p);const saved=(await repo.getKnownBusiness('vendor')).businessProfile;await assert.rejects(orders.reserve('customer','request-precision-'+index++,request(saved)),e=>['product-unavailable','variant-unavailable','fixed-price-required','invalid-price'].includes(e.reason));
 }
}));
test('catalogue changes cannot change retry price or transfer reservation identity',()=>fixture(async({orders,repo,request})=>{
 const req=request(),first=await orders.reserve('customer','request-000000001',req),changed=structuredClone(profile);changed.products[0].presentation.variants[0].pricing.amount=100;await repo.saveBusiness(changed);assert.deepEqual(await orders.reserve('customer','request-000000001',req),first);await rejected(orders.reserve('another','request-000000002',req),'stale-catalogue');
 await orders.release(first.id,'cancelled','customer');assert.equal((await repo.getVendorInventory('vendor')).entries[stock.key('shirt','medium')].reserved,0);
}));
test('read-only owner Orders API enforces ownership and selling intent',()=>fixture(async({repo})=>{
 const auth=require('../api/_lib/demeos-authentication'),previousRepo=persistence.getRepository,previousAuth=auth.resolveTrustedIdentityFromRequest;persistence.getRepository=()=>repo;auth.resolveTrustedIdentityFromRequest=async req=>req.identity?{trustedIdentityId:req.identity}:null;
 const modules=['../api/_lib/demeos-business-owner-authorization','../api/businesses/[businessId]/orders'];for(const m of modules)delete require.cache[require.resolve(m)];const handler=require(modules[1]);
 const call=async(identity,method='GET')=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;return this;}};await handler({identity,method,query:{businessId:'vendor'}},res);return res;};
 try{assert.equal((await call(null)).code,401);assert.equal((await call('foreign')).code,403);const own=await call('owner');assert.equal(own.code,200);assert.deepEqual(own.body.orders,[]);assert.match(own.headers['Cache-Control'],/private, no-store/);assert.equal((await call('owner','POST')).code,405);await repo.saveBusiness({...profile,preparationModel:'marketing'});assert.equal((await call('owner')).code,403);
 }finally{persistence.getRepository=previousRepo;auth.resolveTrustedIdentityFromRequest=previousAuth;for(const m of modules)delete require.cache[require.resolve(m)];}
}));
test('insufficient-stock outcome stays idempotent after replenishment',()=>fixture(async({orders,repo,request})=>{
 const req=request(profile,'medium',6);await rejected(orders.reserve('customer','request-000000001',req),'insufficient-stock');const current=await repo.getVendorInventory('vendor');const updated=stock.applyChanges(profile,current.entries,[{productId:'shirt',variantId:'medium',onHand:10,lowStock:1,sku:'medium',reason:'Replenish'}]);await repo.saveVendorInventory('owner','vendor',profile,current.revision,updated.entries,updated.audit);
 await rejected(orders.reserve('customer','request-000000001',req),'insufficient-stock');assert.equal((await orders.reserve('customer','request-000000002',req)).line.quantity,6);
}));
test('competing manual adjustment and reservation cannot reduce physical stock below holds',()=>fixture(async({orders,repo,request})=>{
 const current=await repo.getVendorInventory('vendor'),change=stock.applyChanges(profile,current.entries,[{productId:'shirt',variantId:'medium',onHand:2,lowStock:1,sku:'medium',reason:'Concurrent count'}]);await Promise.allSettled([orders.reserve('customer','request-000000001',request(profile,'medium',4)),repo.saveVendorInventory('owner','vendor',profile,current.revision,change.entries,change.audit)]);
 const final=await repo.getVendorInventory('vendor'),entry=final.entries[stock.key('shirt','medium')];assert.ok(entry.onHand>=entry.reserved);assert.equal(final.history.length,final.revision);
}));
test('pool transactions pin all statements to one connection and release on rollback',async()=>{
 const seen=[];const connection={async query(sql){seen.push(sql);return {rows:[]};},release(){seen.push('RELEASE');}};const db=createDatabase({async query(){return {rows:[]};},async connect(){seen.push('CONNECT');return connection;}});
 await db.transaction(async tx=>{assert.equal(tx,connection);await tx.query('SELECT isolated');});assert.deepEqual(seen,['CONNECT','BEGIN','SELECT isolated','COMMIT','RELEASE']);seen.length=0;
 await assert.rejects(db.transaction(async tx=>{await tx.query('SELECT failing');throw Error('rollback proof');}),/rollback proof/);assert.deepEqual(seen,['CONNECT','BEGIN','SELECT failing','ROLLBACK','RELEASE']);
});
