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
const submissions=require('./selling-submissions');
const categories=require('./marketing-agent-categories');

function variantSummaries(product){
 const legacy=(product.variants||[]).map(v=>({variantId:v.variantId,name:v.name,sku:v.sku||'',price:v.price||'',availability:v.availability||'contact',inheritsPrice:!v.price}));
 const structured=(product.presentation?.variants||[]).map(v=>({variantId:v.variantId,name:v.name||Object.entries(v.selection||{}).map(([key,value])=>product.presentation.options?.find(o=>o.key===key)?.values.find(x=>x.value===value)?.label||value).join(' / ')||v.variantId,sku:v.sku||'',price:v.pricing?.mode==='fixed'?String(v.pricing.amount):'',availability:v.availability||'contact',inheritsPrice:!v.pricing,structuredPrice:v.pricing?require('../../js/business-product-preparation').priceText(v.pricing):''}));
 return [...legacy,...structured];
}

function businessSummary(profile, env, identityId) {
  const id = profile?.businessId;
  if (typeof id !== 'string' || !id) return null;
  const environment = dataEnvironment(id, env, identityId);
  // Real Selling approval remains unchanged. The explicit Preview test grant
  // has its own authority and never changes the real applicationAccess field.
  if (environment === 'live' && !applicationAccess({businessProfile:profile}, id).selling) return null;
  if(!environment)return null;
  return {businessId:id,name:profile.name||'Unnamed business',type:profile.type||'',location:profile.location||'',dataEnvironment:environment,catalogueRevision:catalogueRevision(profile),
    products:(Array.isArray(profile.products)?profile.products:[]).map(p=>({productId:p.productId,name:p.name,description:p.description,price:p.price,priceMode:p.priceMode,availability:p.availability||'contact',mediaGallery:p.mediaGallery||{assetIds:[],mainAssetId:''},stockQuantity:Number.isSafeInteger(p.stockQuantity)?p.stockQuantity:null,stockHistory:Array.isArray(p.stockHistory)?p.stockHistory:[],variants:variantSummaries(p),classification:p.classification||null,submission:p.submission||null}))};
}

function createHandler({authenticate=authentication.resolveTrustedIdentityFromRequest, repository=()=>persistence.getRepository(), environment=()=>process.env,mediaBackend=media.mediaBackend,resolveSubmissionEvidence}={}) {
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
        if (!authorizeDemeosAction({actorContext,businessId,action:req.method==='POST'?(['register-media','complete-media','resume-media','remove-media','set-main-media'].includes(req.body?.action)?'manage-business-media':'manage-business-profile'):'view-own-business-results'}).allowed) return res.status(403).json({error:'Selling access is unavailable for this business.'});
        const record = await store.getKnownBusiness(businessId);
        business = businessSummary(record?.businessProfile,env,identity.trustedIdentityId);
        if (!business || business.businessId !== businessId) return res.status(403).json({error:'Selling access is unavailable for this business.'});
      }
      if(business){
        const profile=(await store.getKnownBusiness(businessId))?.businessProfile;
        const stock=typeof store.getVendorInventory==='function'?await store.getVendorInventory(businessId):{revision:0,entries:{},history:[]};
        business.inventory={...stock,rows:inventory.rowsFor(profile,inventory.entriesWithLegacyStock(profile,stock.entries))};
        business.media=await media.listMedia(store,profile,backend);business.mediaCapabilities=media.capabilities(backend,env);
        business.orders=typeof store.getVendorOrders==='function'?await store.getVendorOrders(identity.trustedIdentityId,businessId):[];
        business.details={productsServices:profile.productsServices||'',customerContinuation:{email:profile.customerContinuation?.email||'',phone:profile.customerContinuation?.phone||'',website:profile.customerContinuation?.website||''},informationStatus:profile.informationStatus||{}};
        // Business identity is read from the same owned, authoritative record as the catalogue.
        // Do not synthesize an approval status or expose private registration metadata.
        business.identity={name:profile.name||'',type:profile.type||'',location:profile.location||'',description:profile.productsServices||'',contact:business.details.customerContinuation,informationStatus:business.details.informationStatus};
        business.summary={products:business.products.length,availableProducts:business.products.filter(p=>p.availability==='available').length,variants:(profile.products||[]).reduce((sum,p)=>sum+(p.variants?.length||0)+(p.presentation?.variants?.length||0),0),trackedStockRows:business.inventory.rows.filter(r=>r.onHand!==null).length,recentOrders:business.orders.length};
      }
      if (req.method === 'POST') {
        if (!businessId || !business) return res.status(403).json({error:'Select your business.'});
        const action=req.body?.action;
        if(action==='save-business-details'){
          const details=req.body.details,original=(await store.getKnownBusiness(businessId))?.businessProfile;
          if(!details||typeof details!=='object'||Array.isArray(details)||Object.keys(details).some(k=>!['name','location','productsServices','customerContinuation'].includes(k))||req.body.ownerAccuracyConfirmed!==true)return res.status(400).json({error:'Confirm the accuracy of the permitted business details.'});
          if(req.body.catalogueRevision!==catalogueRevision(original))return res.status(409).json({error:'Business changed. Reload before saving.'});
          if(['name','location'].some(k=>typeof details[k]!=='string'||!details[k].trim()||details[k].trim().length>200)||typeof details.productsServices!=='string'||details.productsServices.trim().length>2000)return res.status(400).json({error:'Enter a business name and location, and keep the description within 2000 characters.'});
          const next={...original,name:details.name.trim(),location:details.location.trim(),productsServices:details.productsServices.trim()};
          if(details.customerContinuation!==undefined){
            const contact=details.customerContinuation;
            if(!contact||typeof contact!=='object'||Array.isArray(contact)||Object.keys(contact).some(k=>!['email','phone','website'].includes(k))||['email','phone','website'].some(k=>typeof contact[k]!=='string'||contact[k].length>({email:320,phone:100,website:500}[k])))return res.status(400).json({error:'Enter valid contact details.'});
            const {email,phone,website}=Object.fromEntries(Object.entries(contact).map(([k,v])=>[k,v.trim()]));
            if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone&&!/^\+?[0-9 ()-]{6,30}$/.test(phone))return res.status(400).json({error:'Enter valid contact details.'});
            if(website){try{const url=new URL(website);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{return res.status(400).json({error:'Enter a valid website address.'});}}
            // Contact values are ordinary owner facts. Existing continuation routes,
            // ownership, model, registration and administrative grants stay authoritative.
            next.customerContinuation={...original.customerContinuation,email,phone,website};
          }
          if(!require('../businesses/[businessId].js').validateProfile({body:{businessProfile:next},query:{businessId}}))return res.status(400).json({error:'Complete your existing registration profile before changing these details.'});
          next.informationStatus={...original.informationStatus,source:'business-owner',status:'business-provided',...(original.informationStatus?.reviewState?{reviewState:'draft',submittedAt:null}:{}),ownerConfirmedAt:new Date().toISOString()};
          if(!await store.saveSellingProducts(identity.trustedIdentityId,businessId,original,next))return res.status(409).json({error:'Business access or details changed. Reload before saving.'});
          return res.status(200).json({ok:true});
        }
        const item=req.body?.product;
        if (!['save-product','save-draft','delete-product','adjust-stock','save-variant','delete-variant','register-media','complete-media','resume-media','remove-media','set-main-media','review-product','submit-product','publish-product','unpublish-product'].includes(action) || !item || typeof item!=='object' || Array.isArray(item))
          return res.status(400).json({error:'Invalid product request.'});
        const id=typeof item.productId==='string'?item.productId.trim():'';
        if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return res.status(400).json({error:'Invalid product ID.'});
        const original=(await store.getKnownBusiness(businessId))?.businessProfile;
        if (!original || !businessSummary(original,env,identity.trustedIdentityId))
          return res.status(403).json({error:'Business access unavailable.'});
        if(req.body.catalogueRevision!==catalogueRevision(original))return res.status(409).json({error:'Products changed. Reload before saving.'});
        if(['review-product','submit-product','publish-product','unpublish-product'].includes(action)){
          const result=await submissions.mutate({store,profile:original,productId:id,action,identity:identity.trustedIdentityId,environment:env,confirmed:req.body.confirmed,resolveEvidence:resolveSubmissionEvidence});
          const {status,...body}=result;return res.status(status).json({...body,...(status>=400?{error:'Review the product and its current validation status before continuing.'}:{})});
        }
        if(['register-media','complete-media','resume-media','remove-media','set-main-media'].includes(action)){
          const result=await media.mutateMedia({store,profile:original,identity:identity.trustedIdentityId,action,item,backend,env,saveProfile:(previous,next)=>{next.products=next.products.map(p=>submissions.reconcile(previous.products.find(old=>old.productId===p.productId),p,businessId,identity.trustedIdentityId,['complete-media','resume-media'].includes(action)?'media-processing-completed':action==='set-main-media'?'main-image-selected':'media-removed'));return store.saveSellingProducts(identity.trustedIdentityId,businessId,previous,next);}});
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
          const product=products[index],flat=Array.isArray(product.variants)?product.variants.slice():[],structured=Array.isArray(product.presentation?.variants)?product.presentation.variants.slice():[];
          const flatIndex=flat.findIndex(v=>v.variantId===variantId),structuredIndex=structured.findIndex(v=>v.variantId===variantId);
          if(flatIndex>=0&&structuredIndex>=0)return res.status(409).json({error:'Duplicate recorded variant identities need review in the existing product editor.'});
          const variants=structuredIndex>=0?structured:flat,variantIndex=structuredIndex>=0?structuredIndex:flatIndex;
          if(action==='delete-variant'){
            if(variantIndex<0)return res.status(404).json({error:'Variant not found.'});
            variants.splice(variantIndex,1);
          }else{
            const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
            const name=clean(item.name,160),sku=clean(item.sku,120),price=clean(item.price,100),availability=clean(item.availability,20)||'contact';
            if(!name||(price&&!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(price))||!['contact','available','limited','unavailable'].includes(availability))return res.status(400).json({error:'Enter a variant name, a valid optional price and availability.'});
            if(variantIndex<0&&flat.length>=100)return res.status(409).json({error:'Variant limit reached.'});
            if(sku&&[...flat,...structured].some(v=>v.variantId!==variantId&&v.sku?.toLowerCase()===sku.toLowerCase()))return res.status(400).json({error:'Each variant SKU must be unique for this product.'});
            if(variantIndex<0&&typeof store.getVendorInventory==='function'){const stock=await store.getVendorInventory(businessId);if(stock.entries[inventory.key(id,variantId)])return res.status(409).json({error:'This variant identity has stock history. Create a new variant identity.'});}
            const variant={...(variantIndex>=0?variants[variantIndex]:{}),variantId,name,sku,availability};
            if(structuredIndex>=0){
              if(item.useBasePrice===true)delete variant.pricing;
              else if(price){const currency=variant.pricing?.currency||product.presentation.pricing?.currency;const pricing={...variant.pricing,mode:'fixed',currency,amount:Number(price)};delete pricing.min;delete pricing.max;if(!require('../../js/customer-item-contract').pricing(pricing))return res.status(400).json({error:'The existing variant currency and price must be valid.'});variant.pricing=pricing;}
            }else variant.price=item.useBasePrice===true?'':price;
            if(variantIndex<0)variants.push(variant);else variants[variantIndex]=variant;
          }
          products[index]=structuredIndex>=0?{...product,presentation:{...product.presentation,variants}}:{...product,variants};
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
          if ((action!=='save-draft'&&(!name || !description)) || !['contact','fixed','from','range'].includes(priceMode) || !['contact','available','limited','unavailable'].includes(availability) ||
              (priceMode==='contact'&&price) || (action!=='save-draft'&&priceMode!=='contact'&&!price))
            return res.status(400).json({error:'Invalid product details.'});
          if (index<0 && products.length>=100) return res.status(409).json({error:'Product limit reached.'});
          if(index<0&&typeof store.getVendorInventory==='function'){const stock=await store.getVendorInventory(businessId);if(Object.keys(stock.entries).some(key=>JSON.parse(key)[0]===id))return res.status(409).json({error:'This product identity has stock history. Create the product with a new identity.'});}
          const previous=index>=0?products[index]:{};
          let classification=previous.classification;
          if(Object.hasOwn(item,'classification')){
            classification=item.classification===null?undefined:submissions.categoryReference(item.classification);
            if(item.classification!==null&&!classification)return res.status(400).json({error:'Choose a valid DEMEOS category.',code:'category-integrity'});
          }
          let presentation=previous.presentation;
          if(presentation&&((previous.price||'')!==price||(previous.priceMode||'contact')!==priceMode)){
            const pricing={...presentation.pricing,mode:priceMode==='contact'?'quote':priceMode};
            delete pricing.amount;delete pricing.min;delete pricing.max;
            if(priceMode==='range'){
              const range=price.match(/^(\d+(?:\.\d{1,2})?)\s*[-–]\s*(\d+(?:\.\d{1,2})?)$/);
              if(!range)return res.status(400).json({error:'Enter a minimum and maximum price, such as 5–10.'});
              pricing.min=Number(range[1]);pricing.max=Number(range[2]);
            }else if(priceMode!=='contact'){
              if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(price))return res.status(400).json({error:'Enter a numeric product price in the saved currency.'});
              pricing.amount=Number(price);
            }
            if(!require('../../js/customer-item-contract').pricing(pricing))return res.status(400).json({error:'Check the saved currency and product price range.'});
            presentation={...presentation,pricing};
          }
          const product={...previous,...(presentation?{presentation}:{}),productId:id,businessId,name,description,price,priceMode,...(index<0?{customerVisible:false}:{}),
            availability};
          if(classification)product.classification=classification;else delete product.classification;
          if (index<0) products.push(product); else products[index]=product;
        }
        const updated={...original,products:products.map(p=>submissions.reconcile(original.products.find(old=>old.productId===p.productId),p,businessId,identity.trustedIdentityId,action==='save-variant'||action==='delete-variant'?'variants-edited':'product-edited'))};
        // Only this trusted authoring path initializes a new draft.
        for(const p of updated.products)if(!original.products.some(old=>old.productId===p.productId)){p.submission=submissions.draft(p,businessId,identity.trustedIdentityId);p.customerVisible=false;}
        const saved=await store.saveSellingProducts(identity.trustedIdentityId,businessId,original,updated);
        if (!saved) return res.status(409).json({error:'Business changed. Reload and retry.'});
        return res.status(200).json({ok:true});
      }
      return res.status(200).json({contractVersion:1, vendor:{identityId:identity.trustedIdentityId}, businesses, business, categories:{datasetVersion:categories.DATASET_VERSION,sectors:categories.SECTORS,items:categories.CATEGORIES},phase:1});
    } catch {
      return res.status(503).json({error:'Your Selling dashboard could not load. Please retry.'});
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.dataEnvironment = dataEnvironment;
module.exports.isolatedTestEnvironment = isolatedTestEnvironment;
