// AREA 1 direct-business payment foundation. Inputs are private server records.
// No gateway, commercial fee, seller account or payment evidence is inferred.
'use strict';
const {createHash}=require('node:crypto');
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim()&&x.length<=200;
const money=x=>Number.isSafeInteger(x)&&x>=0;
const STATES=new Set(['creating','pending','paid','failed','cancelled','partially-refunded','refunded']);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function prepareQuote(value,now=Date.now()){
 if(!object(value)||value.mode!=='test'||value.recipient!=='business'||!text(value.customerId)||!text(value.businessId)||!text(value.productId)||!text(value.sellerName)||!text(value.productName)||!text(value.sellerContact)||!text(value.refundTerms)||!text(value.merchantAccountId)||value.sellerVerified!==true||value.disclosuresVerified!==true)return null;
 if(!object(value.selection)||Object.keys(value.selection).length>9||Object.entries(value.selection).some(([k,v])=>!['size','colour','weight','quantity','packSize','duration','location','people','date'].includes(k)||!text(v)))return null;
 if(!text(value.fulfilmentReference)||!Number.isSafeInteger(value.quantity)||value.quantity<1||value.quantity>20||!money(value.unitMinor)||value.unitMinor<=0||!money(value.deliveryMinor)||!money(value.taxMinor)||!money(value.totalMinor)||!/^[A-Z]{3}$/.test(value.currency||'')||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+3600000)return null;
 const total=value.unitMinor*value.quantity+value.deliveryMinor+value.taxMinor;
 if(!Number.isSafeInteger(total)||value.totalMinor!==total||!['delivery','collection','appointment','digital'].includes(value.fulfilmentMethod)||value.fulfilmentVerified!==true)return null;
 // Personal delivery/service details belong in the fulfilment record, not the gateway metadata.
 const quote={mode:'test',recipient:'business',customerId:value.customerId,businessId:value.businessId,productId:value.productId,sellerName:value.sellerName,productName:value.productName,sellerContact:value.sellerContact,refundTerms:value.refundTerms,merchantAccountId:value.merchantAccountId,selection:{...value.selection},quantity:value.quantity,unitMinor:value.unitMinor,deliveryMinor:value.deliveryMinor,taxMinor:value.taxMinor,totalMinor:total,currency:value.currency,fulfilmentMethod:value.fulfilmentMethod,fulfilmentReference:value.fulfilmentReference,expiresAt:value.expiresAt};
 const {expiresAt,...stable}=quote;
 return {...quote,fingerprint:createHash('sha256').update(JSON.stringify(canonical(stable))).digest('hex')};
}
function matches(record,evidence){
 return object(record)&&object(record.quote)&&object(evidence)&&text(record.id)&&text(record.paymentId)&&text(evidence.orderId)&&text(evidence.paymentId)&&evidence.mode==='test'&&evidence.orderId===record.id&&evidence.paymentId===record.paymentId&&evidence.merchantAccountId===record.quote.merchantAccountId&&evidence.currency===record.quote.currency&&evidence.amountMinor===record.quote.totalMinor;
}
function transition(record,evidence){
 if(!STATES.has(record?.state)||!matches(record,evidence)||!money(evidence.refundedMinor)||evidence.refundedMinor>record.quote.totalMinor)return null;
 if(!['pending','paid','failed','cancelled'].includes(evidence.status))return null;
 const settled=['paid','partially-refunded','refunded'].includes(record.state);
 if(evidence.status!=='paid'){
  if(evidence.refundedMinor!==0)return null;
  // A late failure/cancellation must never erase a verified payment or refund.
  return {...record,state:settled?record.state:evidence.status};
 }
 if(evidence.refundedMinor<(record.refundedMinor||0))return {...record};
 return {...record,state:evidence.refundedMinor===record.quote.totalMinor?'refunded':evidence.refundedMinor>0?'partially-refunded':'paid',refundedMinor:evidence.refundedMinor};
}
function customerReceipt(record,customerId){
 if(!object(record)||!object(record.quote)||record.quote.customerId!==customerId||!STATES.has(record.state))return null;
 const q=record.quote;
 return {reference:record.id,testMode:true,recipient:'business',state:record.state,businessId:q.businessId,productId:q.productId,sellerName:q.sellerName,productName:q.productName,selection:{...q.selection},quantity:q.quantity,currency:q.currency,unitMinor:q.unitMinor,deliveryMinor:q.deliveryMinor,taxMinor:q.taxMinor,totalMinor:q.totalMinor,refundedMinor:record.refundedMinor||0,sellerContact:q.sellerContact,refundTerms:q.refundTerms,fulfilmentMethod:q.fulfilmentMethod,paid:['paid','partially-refunded','refunded'].includes(record.state)};
}
module.exports={prepareQuote,transition,customerReceipt,matches};
