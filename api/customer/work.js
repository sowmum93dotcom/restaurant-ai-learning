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

function productExperienceTestContent() {
  return [
    {
      workItemId: "test-product-experience",
      businessId: "test-business-product-experience",
      businessName: "DEMEOS Product Experience Test",
      location: "Controlled test environment",
      content: "Controlled product content for validating the real DEMEOS Customer Experience before payment development.",
      participationAction: "Interested",
      customerContinuation: { routes: ["website"], website: "https://www.demeos.io/" },
      products: [
        { productId: "test-product-one", businessId: "test-business-product-experience", name: "DEMEOS Test Product",
          description: "Available controlled product for validating the new Product Experience.", price: "£45", priceMode: "fixed",
          imageUrl: "https://www.demeos.io/images/54017379-F4D1-4881-A27E-E59CAFD4661C.png",
          videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          continuationRoute: "website", availability: "available" }
      ],
      media: [
        { assetId: "test-product-image-one", kind: "image", role: "primary", deliveryUrl: "https://www.demeos.io/images/54017379-F4D1-4881-A27E-E59CAFD4661C.png",
          purpose: "product", relatedEntityId: "test-product-one" },
        { assetId: "test-product-video-one", kind: "video", role: "supporting", deliveryUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          purpose: "product", relatedEntityId: "test-product-one" }
      ]
    }
  ];
}

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
  if (headers[DISCOVER_TEST_MODE_HEADER] === DISCOVER_TEST_MODE_VALUE || headers[DISCOVER_TEST_MODE_LEGACY_HEADER] === DISCOVER_TEST_MODE_VALUE) return true;
  try {
    const url = new URL(req && req.url || "", "https://demeos.local");
    return url.searchParams.get(DISCOVER_TEST_MODE_QUERY) === "1";
  } catch (_error) { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (isDiscoverTestMode(req)) return res.status(200).json({ work: discoverTestContent(req) });
  if (!canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action: DEMEOS_ACTIONS.VIEW_PUBLIC_WORK })) return res.status(403).json({ error: "Forbidden" });
  const repository = getRepository();
  const work = await repository.listPublicCustomerWork();
  return res.status(200).json({ work: getValidPublicCustomerWork(work) });
};
