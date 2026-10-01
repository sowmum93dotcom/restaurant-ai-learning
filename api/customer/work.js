const { getRepository } = require("../_lib/persistence.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../_lib/demeos-rules.js");
const { getValidPublicCustomerWork } = require("../_lib/customer-public-work-contract.js");

const DISCOVER_TEST_MODE_HEADER = "x-demeos-test-mode";
const DISCOVER_TEST_MODE_LEGACY_HEADER = "x-demeos-discover-test";
const DISCOVER_TEST_MODE_VALUE = "controlled-preview";
const DISCOVER_TEST_MODE_QUERY = "demeos-test";

const { productExperienceTestContent } = require("../_lib/controlled-customer-test-content.js");

function legacyDiscoverTestContent() {
  return [
    {
      workItemId: "test-discover-bistro", businessId: "test-business-bistro", businessName: "DEMEOS Test Bistro",
      location: "Test environment", content: "Controlled test content for validating the populated DEMEOS Discover experience.",
      participationAction: "Interested", customerContinuation: { routes: ["website"], website: "https://example.com/demeos-test-bistro" },
      products: [
        { productId: "test-bistro-meal", businessId: "test-business-bistro", name: "Test Bistro Meal", description: "Available controlled test product with validated continuation.", price: "£18", priceMode: "fixed", imageUrl: "https://www.demeos.io/images/discover-test-meal.svg", continuationRoute: "website", availability: "available" },
        { productId: "test-bistro-unavailable", businessId: "test-business-bistro", name: "Unavailable Test Meal", description: "Controlled unavailable product used to verify safe non-continuation.", price: "£22", priceMode: "fixed", imageUrl: "https://www.demeos.io/images/discover-test-meal.svg", continuationRoute: "website", availability: "unavailable" }
      ],
      media: [
        { assetId: "test-bistro-image", kind: "image", role: "primary", deliveryUrl: "https://www.demeos.io/images/discover-test-bistro-gallery.svg", purpose: "business" },
        { assetId: "test-bistro-view-only", kind: "image", role: "supporting", deliveryUrl: "https://www.demeos.io/images/discover-test-bistro-view-only.svg" }
      ]
    },
    {
      workItemId: "test-discover-studio", businessId: "test-business-studio", businessName: "DEMEOS Test Studio",
      location: "Test environment", content: "A second controlled business for testing vertical distribution and horizontal discovery.",
      participationAction: "Interested", customerContinuation: { routes: ["booking"], bookingLink: "https://example.com/demeos-test-studio" },
      products: [{ productId: "test-studio-service", businessId: "test-business-studio", name: "Test Studio Session", description: "Controlled service used to validate service presentation and booking continuation.", imageUrl: "https://www.demeos.io/images/discover-test-session.svg", continuationRoute: "booking", availability: "limited" }],
      media: [
        { assetId: "test-studio-image", kind: "image", role: "primary", deliveryUrl: "https://www.demeos.io/images/discover-test-studio-gallery.svg", purpose: "business" },
        { assetId: "test-studio-video", kind: "video", role: "supporting", deliveryUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", purpose: "business" },
        { assetId: "test-studio-missing-match", kind: "image", role: "supporting", deliveryUrl: "https://www.demeos.io/images/discover-test-studio-view-only.svg", purpose: "product", relatedEntityId: "missing-test-product" }
      ]
    },
    {
      workItemId: "test-discover-market", businessId: "test-business-market", businessName: "DEMEOS Test Market",
      location: "Test environment", content: "Controlled content for testing a business with view-only media and no customer continuation.",
      participationAction: "Interested",
      media: [{ assetId: "test-market-image", kind: "image", role: "primary", deliveryUrl: "https://www.demeos.io/images/discover-test-market-gallery.svg" }]
    }
  ];
}

function discoverTestContent(req) {
  const headers = req && req.headers || {};
  if (headers[DISCOVER_TEST_MODE_LEGACY_HEADER] === DISCOVER_TEST_MODE_VALUE) return legacyDiscoverTestContent();
  return productExperienceTestContent();
}

function isDiscoverTestMode(req) {
  const headers = req && req.headers || {};
  const header = headers[DISCOVER_TEST_MODE_HEADER];
  const legacyHeader = headers[DISCOVER_TEST_MODE_LEGACY_HEADER];
  const query = req && req.query && req.query[DISCOVER_TEST_MODE_QUERY];
  const legacyControlledPreview = query === "1" && legacyHeader === DISCOVER_TEST_MODE_VALUE;
  const productControlledPreview = query === "1" && header === DISCOVER_TEST_MODE_VALUE;
  return legacyControlledPreview || productControlledPreview;
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
      work: getValidPublicCustomerWork(discoverTestContent(req)),
      customerPackages: [],
      testMode: true
    });
  }
  try {
    const work = await getRepository().getCustomerWork();
    const publicWork = getValidPublicCustomerWork(work);
    return res.status(200).json({
      work: publicWork,
      testMode: false,
      customerPackages: []
    });
  } catch (error) {
    console.error("Could not load customer work:", error);
    return res.status(500).json({ error: "DEMEOS could not load customer work." });
  }
};

module.exports.discoverTestContent = legacyDiscoverTestContent;
module.exports.isDiscoverTestMode = isDiscoverTestMode;
