'use strict';
// Server-only foundation. No customer checkout or payment event calls this writer.
const {randomUUID,createHash}=require('node:crypto');
const inventory=require('./vendor-inventory');
const item=require('../../js/customer-item-contract');
const {workspaceReadiness}=require('./business-workspace-readiness');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=reason=>{const error=new Error(reason);error.reason=reason;throw error;};
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(value);
function requestSignature(request){
 const fields=['businessId','productId','variantId','selection','quantity','catalogueRevision','stockIdentity'];
 if(!request||Object.keys(request).sort().join()!==fields.sort().join()||!id(request.businessId)||!id(request.productId)||typeof request.variantId!=='string'||(request.variantId&&!id(request.variantId))||!request.selection||typeof request.selection!=='object'||Array.isArray(request.selection)||Object.entries(request.selection).some(([k,v])=>!id(k)||typeof v!=='string'||v.length>120)||!inventory.units(request.quantity)||request.quantity<1||!/^[a-f0-9]{64}$/.test(request.catalogueRevision)||!/^[a-f0-9]{64}$/.test(request.stockIdentity))fail('invalid-request');
 return hash([request.businessId,request.productId,request.variantId,Object.entries(request.selection).sort(([a],[b])=>a.localeCompare(b)),request.quantity,request.catalogueRevision,request.stockIdentity]);
}
function resolveLine(profile,request,entries){
 if(inventory.catalogueRevision(profile)!==request.catalogueRevision)fail('stale-catalogue');
 const product=profile.products?.find(p=>p.productId===request.productId&&p.businessId===profile.businessId);
 const presentation=item.normalize(product?.presentation);
 if(profile.businessId.startsWith('test-')||request.productId.startsWith('test-')||profile.testMode===true||product?.controlledTest===true)fail('controlled-record');
 if(!product||!presentation||presentation.kind!=='product'||!['available','limited'].includes(product.availability))fail('product-unavailable');
 const variant=presentation.variants.find(v=>v.variantId===request.variantId);
 if(presentation.variants.length&&!variant||!presentation.variants.length&&(request.variantId||presentation.options.length))fail('variant-unavailable');
 const selection=variant?.selection||{};
 if(hash(Object.entries(selection).sort())!==hash(Object.entries(request.selection).sort()))fail('selection-mismatch');
 if(variant&&!['available','limited'].includes(variant.availability))fail('variant-unavailable');
 const pricing=variant?.pricing||presentation.pricing;
 if(pricing.mode!=='fixed')fail('fixed-price-required');
 const digits=new Intl.NumberFormat('en',{style:'currency',currency:pricing.currency}).resolvedOptions().maximumFractionDigits;
 const minor=pricing.amount*10**digits,rounded=Math.round(minor);
 if(Math.abs(minor-rounded)>0.00001||!Number.isSafeInteger(rounded)||!Number.isSafeInteger(rounded*request.quantity))fail('invalid-price');
 const stockId=inventory.key(product.productId,request.variantId),signature=inventory.stockIdentity(product,variant||{variantId:''}),balance=entries[stockId];
 if(signature!==request.stockIdentity||balance?.identity!==signature)fail('stale-stock-identity');
 if(!inventory.units(balance.onHand)||!inventory.units(balance.reserved)||balance.onHand-balance.reserved<request.quantity)fail('insufficient-stock');
 return {productId:product.productId,variantId:request.variantId,selection,stockIdentity:signature,stockKey:stockId,name:product.name,quantity:request.quantity,currency:pricing.currency,unitPriceMinor:rounded,totalPriceMinor:rounded*request.quantity,currencyDigits:digits};
}
function createVendorOrders(database,{authorizePurchase=(record,businessId)=>workspaceReadiness(record,businessId)?.selling?.canSell===true}={}){
 async function existing(tx,customer,key,signature){const row=(await tx.query('SELECT result,request_signature FROM demeos_vendor_order_requests WHERE customer_id=$1 AND request_key=$2',[customer,key])).rows[0];if(row&&row.request_signature!==signature)fail('idempotency-conflict');return row?.result;}
 async function receipt(tx,customer,key,signature,businessId,result){
  await tx.query('INSERT INTO demeos_vendor_order_requests(customer_id,request_key,request_signature,business_id,result) VALUES($1,$2,$3,$4,$5::jsonb)',[customer,key,signature,businessId,JSON.stringify(result)]);return result;
 }
 async function writeStock(tx,businessId,stock,entries,actor,changes){
  const saved=(await tx.query('UPDATE demeos_vendor_inventory SET entries=$2::jsonb,revision=revision+1,updated_at=NOW() WHERE business_id=$1 AND revision=$3 RETURNING revision',[businessId,JSON.stringify(entries),stock.revision])).rows[0];
  if(!saved)fail('stock-conflict');
  await tx.query('INSERT INTO demeos_vendor_stock_history(business_id,revision,trusted_identity_id,changes) VALUES($1,$2,$3,$4::jsonb)',[businessId,saved.revision,actor,JSON.stringify(changes)]);return saved.revision;
 }
 async function reserve(customer,requestKey,request){
  if(!id(customer)||typeof requestKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))fail('invalid-identity');
  const signature=requestSignature(request);
  const run=()=>database.transaction(async tx=>{
   const old=await existing(tx,customer,requestKey,signature);if(old)return old;
   const business=(await tx.query('SELECT profile FROM demeos_businesses WHERE business_id=$1 FOR UPDATE',[request.businessId])).rows[0];
   if(!business||business.profile.businessId!==request.businessId||!['selling','both'].includes(business.profile.preparationModel))fail('selling-not-authorised');
   // Recheck both authority and customer role while catalogue and stock are locked.
   const owners=await tx.query('SELECT business_id FROM demeos_business_owners WHERE trusted_identity_id=$1',[customer]);
   if(owners.rows.length)fail('customer-only');
   if(authorizePurchase({businessProfile:business.profile},request.businessId)!==true)fail('selling-not-authorised');
   const replay=await existing(tx,customer,requestKey,signature);if(replay)return replay;
   const stock=(await tx.query('SELECT revision,entries FROM demeos_vendor_inventory WHERE business_id=$1 FOR UPDATE',[request.businessId])).rows[0];
   let line;try{if(!stock)fail('stock-unrecorded');line=resolveLine(business.profile,request,stock.entries);}catch(error){if(!error.reason)throw error;return receipt(tx,customer,requestKey,signature,request.businessId,{errorReason:error.reason});}
   const entries=structuredClone(stock.entries);
   entries[line.stockKey].reserved+=line.quantity;
   const clock=(await tx.query('SELECT clock_timestamp() AS now')).rows[0].now,createdAt=new Date(clock).toISOString(),expiresAt=new Date(new Date(clock).getTime()+900000).toISOString();
   const record={id:randomUUID(),businessId:request.businessId,customerId:customer,source:'authoritative-catalogue',mode:'live',state:'reserved',paymentState:'not-started',catalogueRevision:request.catalogueRevision,line,remainingReserved:line.quantity,createdAt,expiresAt};
   await tx.query('INSERT INTO demeos_vendor_orders(order_id,business_id,customer_id,request_key,request_signature,record,state,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[record.id,record.businessId,customer,requestKey,signature,JSON.stringify(record),record.state,expiresAt]);
   const revision=await writeStock(tx,record.businessId,stock,entries,customer,[{event:'reserved',orderId:record.id,productId:line.productId,variantId:line.variantId,identity:line.stockIdentity,quantity:line.quantity,beforeReserved:stock.entries[line.stockKey].reserved,afterReserved:entries[line.stockKey].reserved}]);
   await tx.query('INSERT INTO demeos_vendor_order_events(order_id,event,actor_id,inventory_revision) VALUES($1,$2,$3,$4)',[record.id,'reserved',customer,revision]);return receipt(tx,customer,requestKey,signature,request.businessId,{record});
  });
  let result;try{result=await run();}catch(error){if(error.code!=='23505')throw error;result=await run();}
  if(result.errorReason)fail(result.errorReason);return result.record;
 }
 async function release(orderId,transition,actor){
  if(!id(orderId)||!['cancelled','expired'].includes(transition)||!id(actor))fail('invalid-transition');
  return database.transaction(async tx=>{
   const hint=(await tx.query('SELECT business_id FROM demeos_vendor_orders WHERE order_id=$1',[orderId])).rows[0];if(!hint)fail('not-found');
   await tx.query('SELECT business_id FROM demeos_businesses WHERE business_id=$1 FOR UPDATE',[hint.business_id]);
   const row=(await tx.query('SELECT record FROM demeos_vendor_orders WHERE order_id=$1 FOR UPDATE',[orderId])).rows[0],order=row.record;
   if(transition==='cancelled'&&order.customerId!==actor)fail('ownership-denied');
   if(transition==='expired'&&actor!=='reservation-expiry-worker')fail('expiry-authority-required');
   if(order.state===transition)return order;
   if(order.state!=='reserved'||order.paymentState!=='not-started')fail('invalid-transition');
   const clock=(await tx.query('SELECT clock_timestamp() AS now')).rows[0].now;
   if(transition==='expired'&&new Date(order.expiresAt)>new Date(clock))fail('not-expired');
   const stock=(await tx.query('SELECT revision,entries FROM demeos_vendor_inventory WHERE business_id=$1 FOR UPDATE',[order.businessId])).rows[0],balance=stock?.entries[order.line.stockKey];
   if(!balance||balance.identity!==order.line.stockIdentity||balance.reserved<order.remainingReserved)fail('reservation-integrity');
   const entries=structuredClone(stock.entries);entries[order.line.stockKey].reserved-=order.remainingReserved;
   const next={...order,state:transition,remainingReserved:0,releasedAt:new Date(clock).toISOString()};
   const revision=await writeStock(tx,order.businessId,stock,entries,actor,[{event:transition,orderId,productId:order.line.productId,variantId:order.line.variantId,identity:order.line.stockIdentity,quantity:order.remainingReserved,beforeReserved:balance.reserved,afterReserved:entries[order.line.stockKey].reserved}]);
   await tx.query('UPDATE demeos_vendor_orders SET record=$2::jsonb,state=$3 WHERE order_id=$1',[orderId,JSON.stringify(next),transition]);
   await tx.query('INSERT INTO demeos_vendor_order_events(order_id,event,actor_id,inventory_revision) VALUES($1,$2,$3,$4)',[orderId,transition,actor,revision]);return next;
  });
 }
 async function expireDue(){await database.ensureSchema();const due=(await database.query("SELECT order_id FROM demeos_vendor_orders WHERE state='reserved' AND expires_at<=clock_timestamp() ORDER BY expires_at,order_id LIMIT 100")).rows;const results=[];for(const row of due){try{results.push(await release(row.order_id,'expired','reservation-expiry-worker'));}catch(error){if(error.reason!=='invalid-transition')throw error;}}return results;}
 async function listOwned(identity,businessId){await database.ensureSchema();return (await database.query("SELECT record FROM demeos_vendor_orders v WHERE business_id=$1 AND EXISTS(SELECT 1 FROM demeos_business_owners o JOIN demeos_businesses b USING(business_id) WHERE o.business_id=v.business_id AND o.trusted_identity_id=$2 AND b.profile->>'preparationModel' IN ('selling','both')) ORDER BY created_at DESC,order_id DESC LIMIT 50",[businessId,identity])).rows.map(({record})=>({id:record.id,state:record.state,createdAt:record.createdAt,expiresAt:record.expiresAt,line:record.line}));}
 return Object.freeze({reserve,release,expireDue,listOwned});
}
module.exports={createVendorOrders,resolveLine,requestSignature};
