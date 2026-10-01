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

  function pauseExperienceVideos(document) {
    if (typeof document.querySelectorAll === "function") document.querySelectorAll("#discover video, #product-experience video").forEach(function (video) { video.pause(); });
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

    pauseExperienceVideos(document);
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
    pauseExperienceVideos(document);
    surface.hidden = true;
    discover.hidden = false;
    surface.removeAttribute("data-product-id");
    surface.removeAttribute("data-continuation-type");
    if (window.location.hash !== "#discover") history.replaceState(null, "", "#discover");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function firstNode(card, selectors) {
    for (let i = 0; i < selectors.length; i += 1) {
      const node = card.querySelector(selectors[i]);
      if (node) return node;
    }
    return null;
  }

  function productFromCard(card) {
    if (!card) return null;
    const name = firstNode(card, [".customer-product-name", ".customer-discover-option-name"]);
    const description = firstNode(card, [".customer-product-description", ".customer-discover-option-description"]);
    const price = firstNode(card, [".customer-product-price", ".customer-discover-option-price"]);
    const availability = firstNode(card, [".customer-product-availability", ".customer-discover-option-availability"]);
    const image = firstNode(card, [".customer-product-image-frame img", ".customer-discover-option-image"]);
    const route = card.getAttribute("data-continuation-route") || "website";
    return {
      productId: card.getAttribute("data-product-id") || "",
      name: name ? name.textContent : "",
      description: description ? description.textContent : "",
      price: price ? price.textContent : "",
      imageUrl: image ? image.src : "",
      availability: card.getAttribute("data-availability") || (availability && /not currently available|unavailable/i.test(availability.textContent) ? "unavailable" : availability && /limited/i.test(availability.textContent) ? "limited" : availability && /contact/i.test(availability.textContent) ? "contact" : "available"),
      continuationRoute: route
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
    const back = document.getElementById("product-experience-back");
    const action = document.getElementById("product-experience-action");
    if (!back || !action) return;

    back.addEventListener("click", function () { closeProductExperience(document); });
    action.addEventListener("click", function (event) {
      if (action.getAttribute("data-demeos-purchase") !== "pending") return;
      event.preventDefault();
      action.textContent = "DEMEOS buying is not active yet";
      action.setAttribute("aria-disabled", "true");
    });

    document.addEventListener("click", function (event) {
      const target = event.target && event.target.closest ? event.target.closest(".customer-product-continue-action, .customer-discover-option a") : null;
      if (!target) return;
      const card = target.closest(".customer-product-card, .customer-discover-option");
      if (!card) return;
      const destination = safeHttps(target.href);
      const product = productFromCard(card);
      if (!product) return;
      event.preventDefault();
      const workCard = card.closest(".customer-focused-possibility, .customer-work-card, article[data-discover-position]");
      const businessNameNode = workCard && workCard.querySelector ? workCard.querySelector(".customer-possibility-provider, .customer-business-name, .customer-work-business-name, h3") : null;
      openProductExperience(document, { businessName: businessNameNode ? businessNameNode.textContent : "" }, product, destination);
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { pauseExperienceVideos, closeProductExperience, availabilityCopy, configureAction, continuationType, openProductExperience, priceCopy, recoverDiscoverIfNeeded, safeHttps };
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () { initialize(document); });
})();
