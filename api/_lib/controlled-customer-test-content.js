// Supplied media is synthetic test inventory, never a published vendor record.
const IMAGE_ROOT = "https://www.demeos.io/images/discover-test-";
const TEST_DESTINATION = "https://www.demeos.io/customer.html?demeos-test=1#discover";
function product(businessId, productId, name, image) {
  return { businessId, productId, name, description: "Controlled test item. This is not a live offer.",
    imageUrl: IMAGE_ROOT + image + ".jpg", continuationRoute: "website", availability: "available" };
}
function business(id, name, products, media) {
  return { workItemId: "test-" + id, businessId: "test-business-" + id,
    businessName: name, location: "Controlled test environment", content: "Controlled test media. No live business offer or purchase.",
    participationAction: "Interested", ...(products.length ? { products, customerContinuation: { routes: ["website"], website: TEST_DESTINATION } } : {}), media };
}
function productMedia(product) {
  return { assetId: "test-image-" + product.productId, kind: "image", role: "primary", deliveryUrl: product.imageUrl,
    purpose: "product", relatedEntityId: product.productId };
}
function productExperienceTestContent() {
  const fashion = [
    product("test-business-fashion", "test-product-one", "Test navy outfit", "fashion-navy"),
    product("test-business-fashion", "test-sportswear", "Test sportswear", "sportswear"),
    product("test-business-fashion", "test-suit", "Test suit", "fashion-suit"),
    product("test-business-fashion", "test-pink-outfit", "Test pink outfit", "fashion-pink")
  ];
  const sports = [product("test-business-sports", "test-running", "Test running experience", "running"),
    product("test-business-sports", "test-football", "Test football experience", "football")];
  const outdoor = [product("test-business-outdoor", "test-fishing", "Test fishing experience", "fishing"),
    product("test-business-outdoor", "test-hiking", "Test hiking experience", "hiking")];
  return [
    business("fashion", "DEMEOS Test Fashion", fashion, fashion.map(productMedia)),
    business("groceries", "DEMEOS Test Groceries", [], [{ assetId: "test-grocery-marketing", kind: "image", role: "primary",
      deliveryUrl: IMAGE_ROOT + "groceries.jpg", purpose: "business" }]),
    business("sports", "DEMEOS Test Sports", sports, sports.map(productMedia)),
    business("outdoor", "DEMEOS Test Outdoor", outdoor, outdoor.map(productMedia)),
    business("nature", "DEMEOS Test Nature", [], [{ assetId: "test-nature-video", kind: "video", role: "primary",
      deliveryUrl: "https://www.demeos.io/media/controlled/customer-outdoor-video.mp4", contentType: "video/mp4", purpose: "business" }])
  ];
}
module.exports = { productExperienceTestContent };
