const { getRepository } = require("../_lib/persistence.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../_lib/demeos-rules.js");
const { getValidPublicCustomerWork } = require("../_lib/customer-public-work-contract.js");

const DISCOVER_TEST_MODE_QUERY = "demeos-test";

function discoverTestContent() {
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
          imageUrl: "https://www.demeos.io/images/discover-test-meal.svg",
          continuationRoute: "website", availability: "available" }
      ],
      media: [
        { assetId: "test-product-image-one", kind: "image", role: "primary", deliveryUrl: "https://www.demeos.io/images/discover-test-bistro-gallery.svg",
          purpose: "product", relatedEntityId: "test-product-one" }
      ]
    }
  ];
}

function isDiscoverTestMode(req) {
  const query = req && req.query && req.query[DISCOVER_TEST_MODE_QUERY];
  return query === "1";
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

module.exports.discoverTestContent = discoverTestContent;
module.exports.isDiscoverTestMode = isDiscoverTestMode;