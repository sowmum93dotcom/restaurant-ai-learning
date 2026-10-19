'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const location=require('../js/selling-business-location');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard');
const {catalogueRevision}=require('../api/_lib/vendor-inventory');
const address={countryCode:'GB',addressLine1:'10 Market Street',addressLine2:'',locality:'London',region:'',postalCode:'SE10 9NN'};
test('global address rules accept countries without postcodes and preserve international text',()=>{
 assert.equal(location.countries.length,249);assert.equal(new Set(location.countries).size,249);
 for(const countryCode of location.countries)assert.ok(location.countryName(countryCode));
 assert.equal(location.flag('GB'),'🇬🇧');assert.equal(location.flag('ZZ'),'');
 assert.equal(location.normalize({...address,countryCode:'ZZ'}),null);
 assert.equal(location.normalize({...address,countryCode:'UK'}),null);
 assert.equal(location.normalize({...address,locality:''}),null);
 assert.equal(location.normalize({...address,addressLine1:'a\nInjected'}),null);
 assert.equal(location.normalize({...address,latitude:0}),null,'No inferred map coordinates');
 assert.deepEqual(location.normalize({countryCode:'SG',addressLine1:'10 Market Street',locality:'Singapore'}),{countryCode:'SG',addressLine1:'10 Market Street',addressLine2:'',locality:'Singapore',region:'',postalCode:''});
 assert.deepEqual(location.normalize({...address,countryCode:'AE',addressLine1:'شارع السوق',locality:'دبي',postalCode:''}),{...address,countryCode:'AE',addressLine1:'شارع السوق',locality:'دبي',postalCode:''});
 assert.equal(location.internationalPhone('+971 50 123 4567'),true);
 assert.equal(location.internationalPhone('020 7946 0123'),false);
 assert.equal(location.internationalPhone('+000 1234567'),false);
 assert.equal(location.internationalPhone('+441234567890123456'),false);
 assert.equal(location.internationalPhone(''),true);
});
test('owned business address saves through SQL, survives reload and cannot bypass ownership or revision',async()=>{
 const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db));
 try{
  await repo.createBusinessForOwner('location-owner',{businessId:'location-shop',preparationModel:'selling',name:'Shop',type:'Retail',location:'Isolated Preview',applicationAccess:{selling:true},products:[]});
  const profile=async()=>(await repo.getKnownBusiness('location-shop')).businessProfile;
  async function call(method,body={},identity='location-owner'){
   const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
   await createHandler({authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repo,environment:()=>({VERCEL_ENV:'production'})})({method,query:{businessId:'location-shop',view:'business'},body},res);return res;
  }
  assert.equal((await call('GET')).body.business.businessAddress,null,'Legacy labels never become a country');
  const details={name:'Shop',businessAddress:address,serviceArea:'Worldwide shipping',productsServices:'Retail goods',customerContinuation:{email:'',phone:'+44 20 7946 0123',website:''}};
  const revision=catalogueRevision(await profile());
  const body={action:'save-business-details',details,ownerAccuracyConfirmed:true,catalogueRevision:revision};
  assert.equal((await call('POST',{...body,details:{...details,businessAddress:{...address,countryCode:'ZZ'}}})).code,400);
  assert.equal((await call('POST',{...body,details:{...details,businessAddress:null}})).code,400);
  assert.equal((await call('POST',body,'another-owner')).code,403);
  assert.equal((await call('POST',body)).code,200);
  assert.equal((await call('POST',body)).code,409);
  const reloaded=(await call('GET')).body.business;
  assert.deepEqual(reloaded.businessAddress,address);assert.equal(reloaded.serviceArea,'Worldwide shipping');
  assert.equal(reloaded.location,'London · United Kingdom');
  assert.deepEqual((await profile()).applicationAccess,{selling:true});
  assert.equal((await profile()).informationStatus.status,'business-provided','Owner confirmation does not verify an address externally');
 }finally{await db.close();}
});
