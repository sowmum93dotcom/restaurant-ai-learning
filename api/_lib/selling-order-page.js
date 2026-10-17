'use strict';
const {dataEnvironment}=require('./selling-access');
function parse(query={}){
 const q=query.q??'',state=query.orderState??'',cursor=query.orderCursor??'';
 if(typeof q!=='string'||q.length>200||typeof state!=='string'||state&&!['reserved','cancelled','expired'].includes(state)||typeof cursor!=='string'||cursor.length>500)throw Error('Invalid order filters.');
 let after=null;
 if(cursor){try{after=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!Array.isArray(after)||after.length!==2||typeof after[0]!=='string'||!Number.isFinite(Date.parse(after[0]))||typeof after[1]!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(after[1]))throw Error();}catch{throw Error('Invalid order page.');}}
 return {q:q.trim(),state,after,limit:25};
}
async function read(database,{identity,businessId,query,environment}){
 await database.ensureSchema();
 const result=await database.query(`WITH owned AS (
 SELECT v.record,v.created_at,v.order_id FROM demeos_vendor_orders v
 WHERE v.business_id=$1 AND EXISTS(SELECT 1 FROM demeos_business_owners o JOIN demeos_businesses b USING(business_id)
 WHERE o.business_id=v.business_id AND o.trusted_identity_id=$2
 AND ((b.business_id !~* '^test-' AND b.profile->'applicationAccess'->'selling'='true'::jsonb) OR $3::boolean))
 AND ($4='' OR v.state=$4) AND ($5='' OR strpos(lower(concat_ws(' ',v.order_id,v.record->'line'->>'name',v.record->'line'->>'productId')),lower($5))>0)
 ), page AS (SELECT * FROM owned WHERE $6::timestamptz IS NULL OR (created_at,order_id)<($6::timestamptz,$7::text)
 ORDER BY created_at DESC,order_id DESC LIMIT 26)
 SELECT (SELECT count(*)::integer FROM owned) total,COALESCE((SELECT jsonb_agg(jsonb_build_object('record',record,'at',created_at,'id',order_id) ORDER BY created_at DESC,order_id DESC) FROM page),'[]'::jsonb) items`,[businessId,identity,dataEnvironment(businessId,environment,identity)==='test',query.state,query.q,query.after?.[0]||null,query.after?.[1]||null]);
 const {items,total}=result.rows[0],more=items.length>25,page=items.slice(0,25),last=page.at(-1);
 return {orders:page.map(({record})=>({id:record.id,state:record.state,paymentState:record.paymentState,createdAt:record.createdAt,expiresAt:record.expiresAt,remainingReserved:record.remainingReserved,line:record.line})),total,nextCursor:more?Buffer.from(JSON.stringify([last.at,last.id])).toString('base64url'):null};
}
module.exports={parse,read};
