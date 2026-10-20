'use strict';
const {createHash}=require('node:crypto');
const categories=require('./marketing-agent-categories');
const {STATES}=require('./selling-submissions');
const SORTS=Object.freeze({name:"lower(p->>'name') ASC",updated:"COALESCE(p->'submission'->>'updatedAt','') DESC",created:"COALESCE(p->'submission'->>'createdAt','') DESC",price:"CASE WHEN p->>'priceMode' IN ('fixed','from') AND p->>'price' ~ '^[0-9]+([.][0-9]{1,2})?$' THEN (p->>'price')::numeric END ASC NULLS LAST",stock:"(s->>'quantity')::bigint ASC NULLS LAST"});
function parse(query={}){
 const read=(key,fallback='')=>{const value=query[key]??fallback;if(typeof value!=='string')throw Error('Invalid catalogue query.');return value;};
 const productId=read('productId');
 const channel=read('channel');
 const q=read('q').trim(),category=read('category'),state=read('state'),availability=read('availability'),stock=read('stock'),validation=read('validation'),sort=read('sort','updated'),offset=read('offset','0'),snapshot=read('snapshot');
 if(channel&&!['b2c','b2b'].includes(channel)||productId&&!/^[a-zA-Z0-9_-]{1,120}$/.test(productId)||q.length>200||category&&!categories.getCategory(category)||state&&!STATES.includes(state)||availability&&!['contact','available','limited','unavailable'].includes(availability)||stock&&!['available','low','sold-out','untracked'].includes(stock)||validation&&!['passed','failed','unavailable','not-checked'].includes(validation)||!Object.hasOwn(SORTS,sort)||!/^\d{1,6}$/.test(offset)||Number(offset)>100000||snapshot&&!/^[a-f0-9]{64}$/.test(snapshot))throw Error('Invalid catalogue query.');
 return {channel,q,productId,category,state,availability,stock,validation,sort,offset:Number(offset),limit:25,snapshot};
}
function stockSummary(rows){
 const result={};for(const row of rows){const item=result[row.productId]||={quantity:null,status:'untracked',skus:[],attention:false};if(row.sku)item.skus.push(row.sku);if(row.available!==null&&!row.blocked){item.quantity=(item.quantity??0)+row.available;if(['low','sold-out'].includes(row.status))item.attention=true;}}
 for(const item of Object.values(result)){item.status=item.quantity===null?'untracked':item.quantity===0?'sold-out':item.attention?'low':'available';delete item.attention;}
 return result;
}
function snapshot(revision,inventoryRevision,query){const {offset,snapshot,...filters}=query;return createHash('sha256').update(JSON.stringify([revision,inventoryRevision,filters])).digest('hex');}
// Existing JSONB catalogue remains the single source of truth. The primary-key
// business lookup and ownership join happen before JSON expansion. Only a page
// crosses the SQL boundary; offset is bound to a catalogue/inventory snapshot.
async function queryPage(database,{identity,businessId,profile,query,stock}){
 await database.ensureSchema();
 const result=await database.query(`WITH source AS (
 SELECT b.profile FROM demeos_businesses b WHERE b.business_id=$1 AND b.profile=$3::jsonb
 AND EXISTS(SELECT 1 FROM demeos_business_owners o WHERE o.business_id=b.business_id AND o.trusted_identity_id=$2)
 ), products AS (
 SELECT p, COALESCE($4::jsonb->(p->>'productId'),'{"status":"untracked","quantity":null,"skus":[]}'::jsonb) s FROM source, jsonb_array_elements(COALESCE(profile->'products','[]'::jsonb)) p
 ), filtered AS (
 SELECT p,s FROM products WHERE ($15='' OR COALESCE(p->>'salesChannel','b2c') IN ($15,'both')) AND ($14='' OR p->>'productId'=$14) AND
 ($5='' OR strpos(lower(concat_ws(' ',p->>'name',p->>'productId',p->>'sku',p->'variants',p->'presentation'->'variants',s->'skus',p->'classification'->>'categoryId',$13::jsonb->>(p->'classification'->>'categoryId'))),lower($5))>0)
 AND ($6='' OR p->'classification'->>'categoryId'=$6)
 AND ($7='' OR COALESCE(p->'submission'->>'state','draft')=$7)
 AND ($8='' OR COALESCE(p->>'availability','contact')=$8)
 AND ($9='' OR s->>'status'=$9)
 AND ($10='' OR CASE WHEN p->'submission'->'validation' IS NULL AND p->'submission'->'review' IS NULL THEN 'not-checked'
 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'submission'->'validation'->'rules',p->'submission'->'review'->'rules','[]'::jsonb)) r WHERE r->>'status'='failed') THEN 'failed'
 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'submission'->'validation'->'rules',p->'submission'->'review'->'rules','[]'::jsonb)) r WHERE r->>'status'<>'passed') THEN 'unavailable' ELSE 'passed' END=$10)
 ), page AS (SELECT p FROM filtered ORDER BY ${SORTS[query.sort]}, p->>'productId' ASC LIMIT $11 OFFSET $12)
 SELECT EXISTS(SELECT 1 FROM source) AS current,(SELECT count(*)::integer FROM filtered) AS total,
 COALESCE((SELECT jsonb_agg(p) FROM page),'[]'::jsonb) AS products`,[businessId,identity,JSON.stringify(profile),JSON.stringify(stock),query.q,query.category,query.state,query.availability,query.stock,query.validation,query.limit,query.offset,JSON.stringify(Object.fromEntries(categories.CATEGORIES.map(c=>[c.categoryId,c.categoryName]))),query.productId,query.channel||'']);
 return result.rows[0];
}
module.exports={parse,stockSummary,snapshot,queryPage,SORTS};
