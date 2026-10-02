const test=require('node:test'),assert=require('node:assert/strict');
const recovery=require('../js/customer-purchase-recovery');
const draft=()=>({version:1,workItemId:'test-discover-family',productId:'test-product-childrens-collection',selection:{size:'medium',colour:'blue'},quantity:2,expires:110000});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
test('checkout retry reference survives refresh and option key order without storing personal details',()=>{
 const s=storage();let generated=0;const make=()=>{generated++;return 'customer-click-key';};
 assert.equal(recovery.nonce(s,draft(),make,10000),'customer-click-key');
 assert.equal(recovery.nonce(s,{...draft(),selection:{colour:'blue',size:'medium'},expires:120000},make,10001),'customer-click-key');assert.equal(generated,1);
 const saved=JSON.parse([...s.data.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['expires','id','selection']);assert.doesNotMatch(JSON.stringify(saved),/address|country|email|customerId|paid|card|merchant|checkoutUrl/);
 assert.equal(recovery.nonce(s,{...draft(),quantity:3},()=> 'changed-click-key',10002),'changed-click-key');
 recovery.clear(s);assert.equal(s.data.size,0);
});
test('expiry, invalid drafts and failed storage never produce an unsafe checkout retry',()=>{
 const s=storage();recovery.nonce(s,draft(),()=> 'original-click-key',10000);assert.equal(recovery.nonce(s,{...draft(),expires:210000},()=> 'refreshed-click-key',110001),'refreshed-click-key');
 assert.equal(recovery.nonce(s,{...draft(),email:'private'},()=> 'must-not-be-used',10000),null);
 assert.equal(recovery.nonce({getItem(){throw Error('blocked');}},draft(),()=> 'must-not-be-used',10000),null);
 assert.equal(recovery.nonce({getItem(){return null;},setItem(){throw Error('blocked');}},draft(),()=> 'must-not-be-used',10000),null);
 assert.equal(recovery.nonce(s,{...draft(),quantity:0},()=> 'must-not-be-used',10000),null);
});
