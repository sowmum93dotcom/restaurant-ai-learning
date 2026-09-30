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

  function openProductExperience(document, work, product, destination) {
    const surface = document.getElementById("product-experience");
    const discover = document.getElementById("discover");
    const intention = document.getElementById("intention");
    if (!surface || !discover || !product) return false;

    const image = document.getElementById("product-experience-image");
    const fallback = document.getElementById("product-experience-image-fallback");
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

    document.getElementById("product-experience-business").textContent = text(work && work.businessName);
    document.getElementById("product-experience-title").textContent = text(product.name) || "Product";
    document.getElementById("product-experience-description").textContent = text(product.description);
    document.getElementById("product-experience-price").textContent = priceCopy(product);
    document.getElementById("product-experience-availability").textContent = availabilityCopy(product.availability);

    const action = document.getElementById("product-experience-action");
    const safeDestination = safeHttps(destination);
    const canContinue = product.availability !== "unavailable" && Boolean(safeDestination);
    action.hidden = !canContinue;
    if (canContinue) {
      action.href = safeDestination;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = product.continuationRoute === "booking" ? "Book with business" : "Where to buy";
    } else {
      action.removeAttribute("href");
      action.removeAttribute("target");
      action.removeAttribute("rel");
    }

    discover.hidden = true;
    if (intention) intention.hidden = true;
    surface.hidden = false;
    surface.setAttribute("data-product-id", text(product.productId));
    window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("product-experience-title").focus({ preventScroll: true });
    return true;
  }

  function closeProductExperience(document) {
    const surface = document.getElementById("product-experience");
    const discover = document.getElementById("discover");
    if (!surface || !discover) return;
    surface.hidden = true;
    discover.hidden = false;
    surface.removeAttribute("data-product-id");
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

  function initialize(document) {
    const list = document.getElementById("customer-work-list");
    const back = document.getElementById("product-experience-back");
    if (!list || !back) return;

    back.addEventListener("click", function () { closeProductExperience(document); });

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

  if (typeof module !== "undefined" && module.exports) module.exports = { availabilityCopy, openProductExperience, priceCopy, safeHttps };
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () { initialize(document); });
})();