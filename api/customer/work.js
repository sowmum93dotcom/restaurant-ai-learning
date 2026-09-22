const { getRepository } = require("../_lib/persistence.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../_lib/demeos-rules.js");
const { getValidPublicCustomerWork } = require("../_lib/customer-public-work-contract.js");

const DISCOVER_TEST_MODE_QUERY = "demeos-test";
const DISCOVER_TEST_MODE_HEADER = "x-demeos-discover-test";

function discoverTestContent() {
  return [
    {
      workItemId: "test-discover-bistro",
      businessId: "test-business-bistro",
      businessName: "DEMEOS Test Bistro",
      location: "Test environment",
      content: "Controlled test content for validating the populated DEMEOS Discover experience.",
      participationAction: "Interested",
      customerContinuation: { routes: ["website"], website: "https://example.com/demeos-test-bistro" },
      products: [
        { productId: "test-bistro-meal", businessId: "test-business-bistro", name: "Test Bistro Meal",
          description: "Available controlled test product with validated continuation.", price: "£18", priceMode: "fixed",
          continuationRoute: "website", availability: "available" },
        { productId: "test-bistro-unavailable", businessId: "test-business-bistro", name: "Unavailable Test Meal",
          description: "Controlled unavailable product used to verify safe non-continuation.", price: "£22", priceMode: "fixed",
          continuationRoute: "website", availability: "unavailable" }
      ],
      media: [
        { assetId: "test-bistro-image", kind: "image", role: "primary", deliveryUrl: "https://picsum.photos/seed/demeos-bistro/1200/900",
          purpose: "product", relatedEntityId: "test-bistro-meal" },
        { assetId: "test-bistro-view-only", kind: "image", role: "supporting", deliveryUrl: "https://picsum.photos/seed/demeos-bistro-view/1200/900" }
      ]
    },
    {
      workItemId: "test-discover-studio",
      businessId: "test-business-studio",
      businessName: "DEMEOS Test Studio",
      location: "Test environment",
      content: "A second controlled business for testing vertical distribution and horizontal discovery.",
      participationAction: "Interested",
      customerContinuation: { routes: ["booking"], bookingLink: "https://example.com/demeos-test-studio" },
      products: [
        { productId: "test-studio-service", businessId: "test-business-studio", name: "Test Studio Session",
          description: "Controlled service used to validate service presentation and booking continuation.",
          continuationRoute: "booking", availability: "limited" }
      ],
      media: [
        { assetId: "test-studio-image", kind: "image", role: "primary", deliveryUrl: "https://picsum.photos/seed/demeos-studio/1200/900",
          purpose: "product", relatedEntityId: "test-studio-service" },
        { assetId: "test-studio-video", kind: "video", role: "supporting", deliveryUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          purpose: "product", relatedEntityId: "test-studio-service" },
        { assetId: "test-studio-missing-match", kind: "image", role: "supporting", deliveryUrl: "https://picsum.photos/seed/demeos-unmatched/1200/900",
          purpose: "product", relatedEntityId: "missing-test-product" }
      ]
    },
    {
      workItemId: "test-discover-market",
      businessId: "test-business-market",
      businessName: "DEMEOS Test Market",
      location: "Test environment",
      content: "Controlled content for testing a business with view-only media and no customer continuation.",
      participationAction: "Interested",
      media: [
        { assetId: "test-market-image", kind: "image", role: "primary", deliveryUrl: "https://picsum.photos/seed/demeos-market/1200/900" }
      ]
    }
  ];
}

function isDiscoverTestMode(req) {
  const query = req && req.query && req.query[DISCOVER_TEST_MODE_QUERY];
  const header = req && req.headers && req.headers[DISCOVER_TEST_MODE_HEADER];
  return query === "1" && header === "controlled-preview";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE
  })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
  if (isDiscoverTestMode(req)) {
    return res.status(200).json({
      work: getValidPublicCustomerWork(discoverTestContent()),
      customerPackages: [],
      testMode: true
    });
  }
  try {
    const work = await getRepository().getCustomerWork();
    return res.status(200).json({
      work: getValidPublicCustomerWork(work),
      // Customer package availability is server-owned. No package definitions exist yet.
      customerPackages: []
    });
  } catch (error) {
    console.error("Could not load customer work:", error);
    return res.status(500).json({ error: "DEMEOS could not load customer work." });
  }
};

module.exports.discoverTestContent = discoverTestContent;
module.exports.isDiscoverTestMode = isDiscoverTestMode;
