// Supplied media fixtures only. Never persisted as business or vendor records.
function productExperienceTestContent() {
  const work = [
  {
    "workItemId": "test-discover-fashion",
    "businessId": "test-business-fashion",
    "businessName": "DEMEOS Test Fashion",
    "location": "Controlled test content",
    "content": "Supplied test media for fashion. Fictional business and destinations for presentation testing only.",
    "participationAction": "Interested",
    "customerContinuation": {
      "routes": [
        "website",
        "booking"
      ],
      "website": "https://www.demeos.io/customer.html?demeos-test=1#discover",
      "bookingLink": "https://www.demeos.io/customer.html?demeos-test=1#discover"
    },
    "products": [
      {
        "productId": "test-product-activewear",
        "businessId": "test-business-fashion",
        "name": "Test Activewear outfit",
        "description": "Controlled activewear outfit presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/activewear.webp",
        "continuationRoute": "website",
        "availability": "available"
      },
      {
        "productId": "test-product-summer-fashion",
        "businessId": "test-business-fashion",
        "name": "Test Summer dress",
        "description": "Controlled summer dress presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/summer-fashion.webp",
        "continuationRoute": "website",
        "availability": "available"
      },
      {
        "productId": "test-product-mens-fashion",
        "businessId": "test-business-fashion",
        "name": "Test Men’s jacket",
        "description": "Controlled men’s jacket presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/mens-fashion.webp",
        "continuationRoute": "website",
        "availability": "available"
      }
    ],
    "media": [
      {
        "assetId": "test-media-activewear",
        "kind": "image",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/activewear.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-activewear"
      },
      {
        "assetId": "test-media-summer-fashion",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/summer-fashion.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-summer-fashion"
      },
      {
        "assetId": "test-media-mens-fashion",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/mens-fashion.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-mens-fashion"
      }
    ]
  },
  {
    "workItemId": "test-discover-groceries",
    "businessId": "test-business-groceries",
    "businessName": "DEMEOS Test Groceries",
    "location": "Controlled test content",
    "content": "Supplied test media for groceries. Fictional business and destinations for presentation testing only.",
    "participationAction": "Interested",
    "media": [
      {
        "assetId": "test-media-groceries",
        "kind": "image",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/groceries.webp",
        "purpose": "business"
      }
    ]
  },
  {
    "workItemId": "test-discover-sports",
    "businessId": "test-business-sports",
    "businessName": "DEMEOS Test Sports",
    "location": "Controlled test content",
    "content": "Supplied test media for sports. Fictional business and destinations for presentation testing only.",
    "participationAction": "Interested",
    "customerContinuation": {
      "routes": [
        "website",
        "booking"
      ],
      "website": "https://www.demeos.io/customer.html?demeos-test=1#discover",
      "bookingLink": "https://www.demeos.io/customer.html?demeos-test=1#discover"
    },
    "products": [
      {
        "productId": "test-product-running",
        "businessId": "test-business-sports",
        "name": "Test Running session",
        "description": "Controlled running session presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/running.webp",
        "continuationRoute": "booking",
        "availability": "available"
      },
      {
        "productId": "test-product-football",
        "businessId": "test-business-sports",
        "name": "Test Football session",
        "description": "Controlled football session presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/football.webp",
        "continuationRoute": "booking",
        "availability": "available"
      }
    ],
    "media": [
      {
        "assetId": "test-media-running",
        "kind": "image",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/running.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-running"
      },
      {
        "assetId": "test-media-football",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/football.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-football"
      }
    ]
  },
  {
    "workItemId": "test-discover-outdoors",
    "businessId": "test-business-outdoors",
    "businessName": "DEMEOS Test Outdoor Activities",
    "location": "Controlled test content",
    "content": "Supplied test media for outdoor activities. Fictional business and destinations for presentation testing only.",
    "participationAction": "Interested",
    "customerContinuation": {
      "routes": [
        "website",
        "booking"
      ],
      "website": "https://www.demeos.io/customer.html?demeos-test=1#discover",
      "bookingLink": "https://www.demeos.io/customer.html?demeos-test=1#discover"
    },
    "products": [
      {
        "productId": "test-product-fishing",
        "businessId": "test-business-outdoors",
        "name": "Test Fishing experience",
        "description": "Controlled fishing experience presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/fishing.webp",
        "continuationRoute": "booking",
        "availability": "available"
      },
      {
        "productId": "test-product-camping",
        "businessId": "test-business-outdoors",
        "name": "Test Camping experience",
        "description": "Controlled camping experience presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/camping.webp",
        "continuationRoute": "booking",
        "availability": "available"
      },
      {
        "productId": "test-product-hiking",
        "businessId": "test-business-outdoors",
        "name": "Test Hiking experience",
        "description": "Controlled hiking experience presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/hiking.webp",
        "continuationRoute": "booking",
        "availability": "available"
      }
    ],
    "media": [
      {
        "assetId": "test-media-fishing",
        "kind": "image",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/fishing.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-fishing"
      },
      {
        "assetId": "test-media-camping",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/camping.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-camping"
      },
      {
        "assetId": "test-media-hiking",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/hiking.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-hiking"
      }
    ]
  },
  {
    "workItemId": "test-discover-family",
    "businessId": "test-business-family",
    "businessName": "DEMEOS Test Children and Family",
    "location": "Controlled test content",
    "content": "Supplied test media for children and family. Fictional business and destinations for presentation testing only.",
    "participationAction": "Interested",
    "customerContinuation": {
      "routes": [
        "website",
        "booking"
      ],
      "website": "https://www.demeos.io/customer.html?demeos-test=1#discover",
      "bookingLink": "https://www.demeos.io/customer.html?demeos-test=1#discover"
    },
    "products": [
      {
        "productId": "test-product-childrens-fashion",
        "businessId": "test-business-family",
        "name": "Test Children’s outfit",
        "description": "Controlled children’s outfit presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/childrens-fashion.webp",
        "continuationRoute": "website",
        "availability": "available"
      },
      {
        "productId": "test-product-toys",
        "businessId": "test-business-family",
        "name": "Test Learning toys",
        "description": "Controlled learning toys presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/toys.webp",
        "continuationRoute": "website",
        "availability": "available"
      },
      {
        "productId": "test-product-childrens-collection",
        "businessId": "test-business-family",
        "name": "Test Children’s clothing collection",
        "description": "Controlled children’s clothing collection presentation. No real sale or booking.",
        "imageUrl": "https://www.demeos.io/images/controlled-test/childrens-collection.webp",
        "continuationRoute": "website",
        "availability": "available"
      }
    ],
    "media": [
      {
        "assetId": "test-media-childrens-fashion",
        "kind": "image",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/childrens-fashion.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-childrens-fashion"
      },
      {
        "assetId": "test-media-toys",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/toys.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-toys"
      },
      {
        "assetId": "test-media-childrens-collection",
        "kind": "image",
        "role": "supporting",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/childrens-collection.webp",
        "purpose": "product",
        "relatedEntityId": "test-product-childrens-collection"
      }
    ]
  },
  {
    "workItemId": "test-discover-garden",
    "businessId": "test-business-garden",
    "businessName": "DEMEOS Test Garden and Wildlife",
    "location": "Controlled test content",
    "content": "Supplied garden and wildlife video. View-only marketing experience with no matched product or buying destination.",
    "participationAction": "Interested",
    "media": [
      {
        "assetId": "test-media-garden-wildlife",
        "kind": "video",
        "role": "primary",
        "deliveryUrl": "https://www.demeos.io/images/controlled-test/garden-wildlife.mp4",
        "contentType": "video/mp4",
        "fallbackSource": { "deliveryUrl": "https://www.demeos.io/images/controlled-test/garden-wildlife.webm", "contentType": "video/webm" },
        "purpose": "business"
      }
    ]
  }
];
  return addStructuredTestItems(work);
}
module.exports = { productExperienceTestContent };

// Prices and selectable examples below are fictional controlled fixtures only.
function addStructuredTestItems(work) {
  const copy = require('../../js/demeos-item-presentation-copy.js').en;
  const fixed = amount => ({mode:'fixed',currency:'GBP',amount});
  const from = amount => ({mode:'from',currency:'GBP',amount});
  const range = (min,max) => ({mode:'range',currency:'GBP',min,max});
  const option = (key,values) => ({key,values:values.map(value=>({value,label:copy.values[value],copyKey:value}))});
  const p = (categoryId,pricing,options=[],variants=[]) => ({categoryId,pricing,options,variants});
  const variant = (variantId,selection,availability,pricing) => ({variantId,selection,availability,...(pricing?{pricing}:{})});
  const clothingOptions = [option('size',['small','medium']),option('colour',['black','blue'])];
  const presentation = {
    'test-product-activewear':p('fashion.apparel',from(45),clothingOptions,[
      variant('active-small-black',{size:'small',colour:'black'},'available',fixed(45)),
      variant('active-medium-black',{size:'medium',colour:'black'},'unavailable',fixed(45)),
      variant('active-small-blue',{size:'small',colour:'blue'},'limited',fixed(47)),
      variant('active-medium-blue',{size:'medium',colour:'blue'},'available',fixed(47))
    ]),
    'test-product-summer-fashion':p('fashion.apparel',fixed(32)),
    'test-product-mens-fashion':p('fashion.apparel',range(60,80),[option('colour',['black','pink'])],[
      variant('jacket-black',{colour:'black'},'limited',fixed(60)),variant('jacket-pink',{colour:'pink'},'available',fixed(80))
    ]),
    'test-product-running':p('sports.sessions',from(20),[option('duration',['minutes30','minutes60']),option('people',['onePerson','twoPeople'])],[
      variant('run-30-one',{duration:'minutes30',people:'onePerson'},'available',fixed(20)),
      variant('run-30-two',{duration:'minutes30',people:'twoPeople'},'limited',fixed(30)),
      variant('run-60-one',{duration:'minutes60',people:'onePerson'},'unavailable',fixed(35))
    ]),
    'test-product-football':p('sports.sessions',fixed(18)),
    'test-product-fishing':p('outdoors.experiences',{mode:'none'}),
    'test-product-camping':p('outdoors.experiences',{mode:'quote'},[
      option('location',['testVenue']),{key:'date',values:[{value:'2026-10-08',label:'2026-10-08'},{value:'2026-10-09',label:'2026-10-09'}]}
    ],[variant('camp-first',{location:'testVenue',date:'2026-10-08'},'available'),variant('camp-second',{location:'testVenue',date:'2026-10-09'},'contact')]),
    'test-product-hiking':p('outdoors.experiences',range(15,25)),
    'test-product-childrens-fashion':p('fashion.apparel',fixed(18)),
    'test-product-toys':p('family.toys',fixed(12)),
    'test-product-childrens-collection':p('fashion.apparel',fixed(25))
  };
  const groceries = work.find(w=>w.workItemId==='test-discover-groceries');
  groceries.customerContinuation={routes:['website'],website:'https://www.demeos.io/customer.html?demeos-test=1#discover'};
  const groceryOptions=[option('weight',['weight500','weight1000']),option('quantity',['quantity1','quantity2']),option('packSize',['pack1','pack2'])];
  const groceryVariants=[];
  for(const weight of groceryOptions[0].values)for(const quantity of groceryOptions[1].values)for(const pack of groceryOptions[2].values){
    const selection={weight:weight.value,quantity:quantity.value,packSize:pack.value};
    const amount=7.5*(weight.value==='weight1000'?2:1)*(quantity.value==='quantity2'?2:1)*(pack.value==='pack2'?2:1);
    groceryVariants.push(variant('grocery-'+groceryVariants.length,selection,'available',fixed(amount)));
  }
  groceries.products=[{productId:'test-product-grocery-pack',businessId:groceries.businessId,name:'Test Grocery pack',description:'Controlled grocery pack presentation. No real sale or booking.',continuationRoute:'website',availability:'available',presentation:p('groceries.packs',from(7.5),groceryOptions,groceryVariants)}];
  // The grocery artwork remains business marketing; it is not a product photograph.
  for(const business of work)for(const product of business.products||[]){
    if(presentation[product.productId])product.presentation=presentation[product.productId];
    if(product.productId==='test-product-toys')product.availability='unavailable';
    if(product.productId==='test-product-fishing')product.availability='limited';
    if(product.productId==='test-product-childrens-collection'){
      product.continuationRoute='demeos';business.customerContinuation.routes.push('demeos');
    }
  }
  return work;
}
