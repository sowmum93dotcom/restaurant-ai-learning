'use strict';
// Owner-authored commercial terms never grant buyer verification or checkout authority.
const MODES=Object.freeze(['b2c','b2b','both']);
const mode=value=>value===undefined?'b2c':MODES.includes(value)?value:null;
const includes=(value,channel)=>mode(value)==='both'||mode(value)===channel;
function permitted(business,product){const b=mode(business),p=mode(product);return Boolean(b&&p&&(b==='both'||b===p));}
function businessTerms(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['method','currency','unitPrice','minimumQuantity','packSize','tiers'].includes(k)))throw Error('Invalid business terms.');
 const {method,currency,minimumQuantity,packSize}=input;
 if(!['quote','direct'].includes(method)||typeof currency!=='string'||!Intl.supportedValuesOf('currency').includes(currency)||!Number.isSafeInteger(minimumQuantity)||minimumQuantity<1||minimumQuantity>1000000||!Number.isSafeInteger(packSize)||packSize<1||packSize>1000000||minimumQuantity%packSize)throw Error('Invalid business terms.');
 const digits=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
 const money=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(value)&&Number(value)>0&&(value.split('.')[1]?.length||0)<=digits;
 const unitPrice=input.unitPrice??'',tiers=input.tiers??[];
 if(!Array.isArray(tiers)||tiers.length>5||method==='quote'&&(unitPrice!==''||tiers.length)||method==='direct'&&!money(unitPrice))throw Error('Invalid business terms.');
 let lastQuantity=minimumQuantity,lastPrice=Number(unitPrice);
 const normalized=tiers.map(t=>{if(!t||Object.keys(t).sort().join()!=='minimumQuantity,unitPrice'||!Number.isSafeInteger(t.minimumQuantity)||t.minimumQuantity<=lastQuantity||t.minimumQuantity>1000000||t.minimumQuantity%packSize||!money(t.unitPrice)||Number(t.unitPrice)>=lastPrice)throw Error('Invalid business terms.');lastQuantity=t.minimumQuantity;lastPrice=Number(t.unitPrice);return {minimumQuantity:t.minimumQuantity,unitPrice:t.unitPrice};});
 return {method,currency,unitPrice,minimumQuantity,packSize,tiers:normalized};
}
function apply(profile,previous,input){
 const salesChannel=mode(Object.hasOwn(input,'salesChannel')?input.salesChannel:previous.salesChannel);
 if(!permitted(profile.salesChannel,salesChannel))throw Error('Choose product channels enabled for your business.');
 const result={salesChannel};
 if(includes(salesChannel,'b2b'))result.businessTerms=businessTerms(Object.hasOwn(input,'businessTerms')?input.businessTerms:previous.businessTerms);
 return result;
}
// Invalid explicit settings fail closed. Missing settings preserve the legacy B2C path.
const allowsConsumer=(profile,product)=>includes(profile?.salesChannel,'b2c')&&includes(product?.salesChannel,'b2c');
module.exports={MODES,mode,includes,permitted,businessTerms,apply,allowsConsumer};
