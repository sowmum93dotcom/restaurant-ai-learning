// Supplied media fixtures only. Never persisted as business or vendor records.
function productExperienceTestContent() {
  return [
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
}
module.exports = { productExperienceTestContent };
