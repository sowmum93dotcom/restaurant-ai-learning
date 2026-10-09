'use strict';
// Isolated engineering source rows. Never inserted into a deployed database.
const {DATASET_VERSION}=require('../../api/_lib/marketing-agent-categories');
function sourceRow(index,{service=false}={}) {
 const businessId='fixture-owner-'+index,productId='fixture-offer-'+index,campaignId='fixture-campaign-'+String(index).padStart(3,'0');
 const name=service?'Cleaning Services':'Black waterproof jacket';
 return {campaign_id:campaignId,business_id:businessId,approved_at:'2026-10-01T00:00:00Z',campaign_updated_at:'2026-10-01T00:00:00Z',
  campaign:{id:campaignId,businessId,campaignType:'social',approvalStatus:'Approved',campaignText:'Published collection',media:[]},
  profile:{businessId,profileVersion:4,name:'Engineering source '+index,location:'Manchester',privateEmail:'private@example.org',adminToken:'private-token',informationStatus:{status:'business-provided',source:'business-owner',ownerConfirmedAt:'2026-10-01T00:00:00Z'},
   customerContinuation:{routes:['website','booking'],website:'https://example.org/shop',bookingLink:'https://example.org/book'},
   products:[{productId,businessId,name,description:service?'Cleaning Services professional cleaning appointment':'Fashion and Apparel Commerce black waterproof jacket',price:'£89',availability:'available',continuationRoute:service?'booking':'website',categoryClassification:{datasetVersion:DATASET_VERSION,categories:[{categoryId:service?'93':'10',sectorId:service?'5':'1'}]},
    presentation:{categoryId:service?'services.appointments':'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:89},options:service?[]:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:service?[]:[{variantId:'variant-'+index,selection:{size:'M'},availability:'available'}]}}]}};
}
module.exports={sourceRow};
