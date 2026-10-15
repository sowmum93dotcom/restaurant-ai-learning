'use strict';
const authentication = require('./demeos-authentication');
const persistence = require('./persistence');
const {catalogueRevision}=require('./vendor-inventory');
const {applicationAccess} = require('./business-application-access');
const {authorizeDemeosAction} = require('./demeos-authorization');
const {createAuthenticatedBusinessOwnerContext} = require('./demeos-actor-context');

const {isolatedTestEnvironment,dataEnvironment}=require('./selling-access');
const inventory=require('./vendor-inventory');
const media=require('./selling-media');

function businessSummary(profile, env, identityId) {
  const id = profile?.businessId;
  if (typeof id !== 'string' || !id) return null;
  const environment = dataEnvironment(id, env, identityId);
  // Real Selling approval remains unchanged. The explicit Preview test grant
  // has its own authority and never changes the real applicationAccess field.
  if (environment === 'live' && !applicationAccess({businessProfile:profile}, id).selling) return null;
  return environment ? {businessId:id, name:profile.name || 'Unnamed business', type:profile.type || '', location:profile.location || '', dataEnvironment:environment, catalogueRevision:catalogueRevision(profile), products:Array.isArray(profile.products)?profile.products.map(p=>({productId:p.productId,name:p.name,description:p.description,price:p.price,priceMode:p.priceMode,availability:p.availability||'contact',mediaGallery:p.mediaGallery||{assetIds:[],mainAssetId:''},stockQuantity:Number.isSafeInteger(p.stockQuantity)?p.stockQuantity:null,stockHistory:Array.isArray(p.stockHistory)?p.stockHistory:[],variants:Array.isArray(p.variants)?p.variants.map(v=>({variantId:v.variantId,name:v.name,sku:v.sku||'',price:v.price||'',availability:v.availability||'contact'})):[]})):[]} : null;
}

function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest, repository=()=>persistence.getRepository(), environment=()=>process.env,mediaBackend=media.mediaBackend}={}) {
  return async function sellingDashboard(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie, Authorization');
    if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
    try {
      const identity = await authenticate(req);
      if (!identity) return res.status(401).json({error:'Sign in to open your Selling dashboard.'});
      const selected = req.query?.businessId;
      if (selected !== undefined && (typeof selected !== 'string' || !selected || selected.length > 200)) return res.status(400).json({error:'Choose a valid business.'});
      const env = environment();
      const backend=mediaBackend(env);
      if (env.DEMEOS_SELLING_DATA_ENVIRONMENT === 'test' && !isolatedTestEnvironment(env)) return res.status(503).json({error:'The isolated Selling Preview is not configured.'});
      const store = repository();
      // SQL ownership relationship is authoritative, never a role/header/URL claim.
      const owned = await store.getOwnedBusinessProfiles(identity.trustedIdentityId);
      const businesses = owned.map(profile=>businessSummary(profile,env,identity.trustedIdentityId)).filter(Boolean).map(({products,catalogueRevision,...summary})=>summary);
      if (selected && !businesses.some(b=>b.businessId===selected)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      const businessId = selected || (businesses.length === 1 ? businesses[0].businessId : null);
      let business = null;
      if (businessId) {
        // Recheck ownership and the applicable server authority on every load.
        if (!await store.isBusinessOwnedByIdentity(identity.trustedIdentityId,businessId)) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const actorContext = createAuthenticatedBusinessOwnerContext({trustedIdentityId:identity.trustedIdentityId,businessId});
        if (!authorizeDemeosAction({actorContext,businessId,action:'view-own-business-results'}).allowed) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const record = await store.getKnownBusiness(businessId);
        business = businessSummary(record?.businessProfile,env,identity.trustedIdentityId);
        if (!business || business.businessId !== businessId) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      }
      if(business){
        const profile=(await store.getKnownBusiness(businessId))?.businessProfile;
        const stock=typeof store.getVendorInventory==='function'?await store.getVendorInventory(businessId):{revision:0,entries:{},history:[]};
        business.inventory={...stock,rows:inventory.rowsFor(profile,inventory.entriesWithLegacyStock(profile,stock.entries))};
        business.media=await media.listMedia(store,profile,backend);business.mediaCapabilities=media.capabilities(backend,env);
      }
      if (req.method === 'POST') {
        if (!businessId || !business) return res.status(403).json({error:'Select your business.'});
        const action=req.body?.action;
        const item=req.body?.product;
        if (!['save-product','delete-product','adjust-stock','save-variant','delete-variant','register-media','complete-media','remove-media'].includes(action) || !item || typeof item!=='object' || Array.isArray(item))
          return res.status(400).json({error:'Invalid product request.'});
        const id=typeof item.productId==='string'?item.productId.trim():'';
        if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return res.status(400).json({error:'Invalid product ID.'});
        const original=(await store.getKnownBusiness(businessId))?.businessProfile;
        if (!original || !businessSummary(original,env,identity.trustedIdentityId))
          return res.status(403).json({error:'Business access unavailable.'});
        if(req.body.catalogueRevision!==catalogueRevision(original))return res.status(409).json({error:'Products changed. Reload before saving.'});
        if(['register-media','complete-media','remove-media'].includes(action)){
          const result=await media.mutateMedia({store,profile:original,identity:identity.trustedIdentityId,action,item,backend,env,saveProfile:(previous,next)=>store.saveSellingProducts(identity.trustedIdentityId,businessId,previous,next)});
          const {status,...body}=result;return res.status(status).json(body);
        }
        const products=Array.isArray(original.products)?original.products.slice():[];
        const index=products.findIndex(product=>product.productId===id);
        if(action==='delete-product'||action==='delete-variant'){
          const stock=await store.getVendorInventory(businessId);
          if(Object.entries(stock.entries).some(([key,row])=>{const [productId,variantId]=JSON.parse(key);return productId===id&&(action==='delete-product'||variantId===item.variantId)&&row.reserved>0;}))return res.status(409).json({error:'This item has reserved stock for an order and cannot be deleted.'});
        }
        if (action==='save-variant' || action==='delete-variant') {
          if (index<0) return res.status(404).json({error:'Product not found.'});
          const variantId=typeof item.variantId==='string'?item.variantId.trim():'';
          if (!/^[a-zA-Z0-9_-]{1,120}$/.test(variantId)) return res.status(400).json({error:'Invalid variant ID.'});
          const variants=Array.isArray(products[index].variants)?products[index].variants.slice():[];
          const variantIndex=variants.findIndex(variant=>variant.variantId===variantId);
          if (action==='delete-variant') {
            if (variantIndex<0) return res.status(404).json({error:'Variant not found.'});
            variants.splice(variantIndex,1);
          } else {
            const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
            const name=clean(item.name,160),sku=clean(item.sku,120),price=clean(item.price,100),availability=clean(item.availability,20)||'contact';
            if (!name || (price&&!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(price)) || !['contact','available','unavailable'].includes(availability)) return res.status(400).json({error:'Invalid variant details.'});
            if (variantIndex<0 && variants.length>=100) return res.status(409).json({error:'Variant limit reached.'});
            if(sku&&variants.some(v=>v.variantId!==variantId&&v.sku?.toLowerCase()===sku.toLowerCase()))return res.status(400).json({error:'Each variant SKU must be unique for this product.'});
            const variant={...(variantIndex>=0?variants[variantIndex]:{}),variantId,name,sku,price,availability};
            if (variantIndex<0) variants.push(variant); else variants[variantIndex]=variant;
          }
          products[index]={...products[index],variants};
        } else if (action==='adjust-stock') {
          if(index<0)return res.status(404).json({error:'Product not found.'});
          const stock=await store.getVendorInventory(businessId);
          if(req.body.inventoryRevision!==stock.revision)return res.status(409).json({error:'Stock changed. Reload before saving.'});
          const entries=inventory.entriesWithLegacyStock(original,stock.entries);
          const variantId=typeof item.variantId==='string'?item.variantId:'';
          const row=inventory.rowsFor(original,entries).find(r=>r.productId===id&&r.variantId===variantId);
          if(!row)return res.status(400).json({error:'Choose a current stock row.'});
          if(row.onHand===item.quantity)return res.status(400).json({error:'Stock quantity has not changed.'});
          let update;try{update=inventory.applyChanges(original,entries,[{productId:id,variantId,onHand:item.quantity,lowStock:row.lowStock,sku:row.sku,reason:item.note}]);}
          catch(error){return res.status(400).json({error:error.message});}
          const saved=await store.saveVendorInventory(identity.trustedIdentityId,businessId,original,stock.revision,update.entries,update.audit);
          if(!saved)return res.status(409).json({error:'Stock or products changed. Reload before saving.'});
          return res.status(200).json({ok:true,revision:saved.revision});
        } else if (action==='delete-product') {
          if (index<0) return res.status(404).json({error:'Product not found.'});
          products.splice(index,1);
        } else {
          const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
          const name=clean(item.name,200),description=clean(item.description,1200);
          const price=clean(item.price,100),priceMode=clean(item.priceMode,20)||'contact';
          const availability=clean(item.availability,20)||'contact';
          if (!name || !description || !['contact','fixed','from','range'].includes(priceMode) || !['contact','available','unavailable'].includes(availability) ||
              (priceMode==='contact'&&price) || (priceMode!=='contact'&&!price))
            return res.status(400).json({error:'Invalid product details.'});
          if (index<0 && products.length>=100) return res.status(409).json({error:'Product limit reached.'});
          const previous=index>=0?products[index]:{};
          if(previous.presentation&&(previous.price!==price||previous.priceMode!==priceMode))return res.status(409).json({error:'Review the saved structured pricing in the existing business product editor before changing its price.'});
          const product={...previous,productId:id,businessId,name,description,price,priceMode,...(index<0?{customerVisible:false}:{}),
            availability};
          if (index<0) products.push(product); else products[index]=product;
        }
        const updated={...original,products};
        const saved=await store.saveSellingProducts(identity.trustedIdentityId,businessId,original,updated);
        if (!saved) return res.status(409).json({error:'Business changed. Reload and retry.'});
        return res.status(200).json({ok:true});
      }
      return res.status(200).json({contractVersion:1, vendor:{identityId:identity.trustedIdentityId}, businesses, business, phase:1});
    } catch {
      return res.status(503).json({error:'Your Selling dashboard could not load. Please retry.'});
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.dataEnvironment = dataEnvironment;
module.exports.isolatedTestEnvironment = isolatedTestEnvironment;
