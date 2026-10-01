const { getValidPublicCustomerWork } = require("../_lib/customer-public-work-contract.js");

function controlledCustomerTestWork() {
  return [
    {
      workItemId: "test-product-experience",
      businessId: "test-business-product-experience",
      businessName: "DEMEOS Test Store",
      location: "Controlled test environment",
      content: "Controlled test content for validating the real DEMEOS Product Experience before payment development.",
      participationAction: "Interested",
      customerContinuation: {
        routes: ["website"],
        website: "https://www.demeos.io/"
      },
      products: [
        {
          productId: "test-demeos-product",
          businessId: "test-business-product-experience",
          name: "DEMEOS Test Product",
          description: "Controlled product for validating the new Product Experience and DEMEOS buying route.",
          price: "£45.00",
          priceMode: "fixed",
          imageUrl: "https://www.demeos.io/images/discover-test-meal.svg",
          continuationRoute: "website",
          availability: "available"
        }
      ],
      media: [
        {
          assetId: "test-product-image",
          kind: "image",
          role: "primary",
          deliveryUrl: "https://www.demeos.io/images/discover-test-bistro-gallery.svg",
          purpose: "product",
          relatedEntityId: "test-demeos-product"
        }
      ]
    }
  ];
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json({
    work: getValidPublicCustomerWork(controlledCustomerTestWork()),
    customerPackages: [],
    testMode: true
  });
};

module.exports.controlledCustomerTestWork = controlledCustomerTestWork;
