(function () {
  "use strict";

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function safeHttps(value) {
    const candidate = text(value);
    return /^https:\/\//i.test(candidate) ? candidate : "";
  }

  function availabilityCopy(value) {
    if (value === "unavailable") return "Currently unavailable";
    if (value === "limited") return "Limited availability";
    if (value === "contact") return "Contact business for availability";
    return "Available";
  }

  function priceCopy(product) {
    const price = text(product && product.price);
    if (!price) return "";
    if (product.priceMode === "from") return "From " + price;
    if (product.priceMode === "range") return "Price range: " + price;
    return price;
  }

  function continuationType(product) {
    const route = text(product && product.continuationRoute).toLowerCase();
    if (route === "demeos" || route === "demeos-purchase" || route === "purchase") return "demeos";
    if (route === "booking") return "booking";
    return "external";
  }

  function configureAction(action, product, destination) {
    if (!action) return false;
    const routeType = continuationType(product);
    const available = product && product.availability !== "unavailable";
    const safeDestination = safeHttps(destination);

    action.hidden = true;
    action.removeAttribute("href");
    action.removeAttribute("target");
    action.removeAttribute("rel");
    action.removeAttribute("data-demeos-purchase");
    action.removeAttribute("aria-disabled");

    if (!available) return false;

    if (routeType === "demeos") {
      action.hidden = false;
      action.href = "#";
      action.textContent = "Buy in DEMEOS";
      action.setAttribute("data-demeos-purchase", "pending");
      return true;
    }

    if (!safeDestination) return false;
    action.hidden = false;
    action.href = safeDestination;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = routeType === "booking" ? "Book with business" : "Where to buy";
    return true;
  }

  function openProductExperience(document, work, product, destination) {
    const surface = document.getElementById("product-experience");
    const discover = document.getElementById("discover");
    const intention = document.getElementById("intention");
    const image = document.getElementById("product-experience-image");
    const fallback = document.getElementById("product-experience-image-fallback");
    const business = document.getElementById("product-experience-business");
    const title = document.getElementById("product-experience-title");
    const description = document.getElementById("product-experience-description");
    const price = document.getElementById("product-experience-price");
    const availability = document.getElementById("product-experience-availability");
    const action = document.getElementById("product-experience-action");
    if (!surface || !discover || !product || !image || !fallback || !business || !title || !description || !price || !availability || !action) return false;

    const imageUrl = safeHttps(product.imageUrl);
    image.hidden = !imageUrl;
    fallback.hidden = Boolean(imageUrl);
    if (imageUrl) {
      image.src = imageUrl;
      image.alt = text(product.name) || "Product";
    } else {
      image.removeAttribute("src");
      image.alt = "";
    }

    business.textContent = text(work && work.businessName);
    title.textContent = text(product.name) || "Product";
    description.textContent = text(product.description);
    price.textContent = priceCopy(product);
    availability.textContent = availabilityCopy(product.availability);
    configureAction(action, product, destination);

    discover.hidden = true;
    if (intention) intention.hidden = true;
    surface.hidden = false;
    surface.setAttribute("data-product-id", text(product.productId));
    surface.setAttribute("data-continuation-type", continuationType(product));
    window.scrollTo({ top: 0, behavior: "auto" });
    title.focus({ preventScroll: true });
    return true;
  }

  function closeProductExperience(document) {
    const surface = document.getElementById("product-experience");
    const discover = document.getElementById("discover");
    if (!surface || !discover) return;
    surface.hidden = true;
    discover.hidden = false;
    surface.removeAttribute("data-product-id");
    surface.removeAttribute("data-continuation-type");
    if (window.location.hash !== "#discover") history.replaceState(null, "", "#discover");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function productFromCard(card) {
    if (!card) return null;
    const name = card.querySelector(".customer-discover-option-name");
    const description = card.querySelector(".customer-discover-option-description");
    const price = card.querySelector(".customer-discover-option-price");
    const availability = card.querySelector(".customer-discover-option-availability");
    const image = card.querySelector(".customer-discover-option-image");
    return {
      productId: card.getAttribute("data-product-id") || "",
      name: name ? name.textContent : "",
      description: description ? description.textContent : "",
      price: price ? price.textContent : "",
      imageUrl: image ? image.src : "",
      availability: availability && /unavailable/i.test(availability.textContent) ? "unavailable" : availability && /limited/i.test(availability.textContent) ? "limited" : availability && /contact/i.test(availability.textContent) ? "contact" : "available",
      continuationRoute: card.getAttribute("data-continuation-route") || "website"
    };
  }

  function recoverDiscoverIfNeeded(document) {
    const status = document.getElementById("customer-work-status");
    const list = document.getElementById("customer-work-list");
    if (!status || !list || list.children.length) return false;
    if (!/loading approved work/i.test(status.textContent || "")) return false;
    if (typeof globalThis.loadCustomerWork !== "function" || typeof globalThis.fetch !== "function") return false;
    globalThis.loadCustomerWork(document, globalThis.fetch, globalThis.location);
    return true;
  }

  function initialize(document) {
    recoverDiscoverIfNeeded(document);
    const list = document.getElementById("customer-work-list");
    const back = document.getElementById("product-experience-back");
    const action = document.getElementById("product-experience-action");
    if (!list || !back || !action) return;

    back.addEventListener("click", function () { closeProductExperience(document); });
    action.addEventListener("click", function (event) {
      if (action.getAttribute("data-demeos-purchase") !== "pending") return;
      event.preventDefault();
      action.textContent = "DEMEOS buying is not active yet";
      action.setAttribute("aria-disabled", "true");
    });

    list.addEventListener("click", function (event) {
      const target = event.target && event.target.closest ? event.target.closest(".customer-discover-option a") : null;
      if (!target) return;
      const card = target.closest(".customer-discover-option");
      const destination = safeHttps(target.href);
      const product = productFromCard(card);
      if (!product) return;
      event.preventDefault();
      const workCard = card.closest(".customer-work-card, article[data-discover-position]");
      const businessNameNode = workCard && workCard.querySelector ? workCard.querySelector(".customer-business-name, .customer-work-business-name, h3") : null;
      openProductExperience(document, { businessName: businessNameNode ? businessNameNode.textContent : "" }, product, destination);
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { availabilityCopy, configureAction, continuationType, openProductExperience, priceCopy, recoverDiscoverIfNeeded, safeHttps };
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () { initialize(document); });
})();
