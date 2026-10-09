(function () {
  "use strict";

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function safeHttps(value) {
    const candidate = text(value);
    return /^https:\/\//i.test(candidate) ? candidate : "";
  }

  // Preserve the existing approved route contract on the receiving screen.
  // Contact links never become scripts or arbitrary application destinations.
  function safeContinuation(product, value) {
    if (typeof value !== 'string' || /[\r\n\x00]/.test(value)) return "";
    const candidate = text(value), route = product && product.continuationRoute;
    if (!candidate || /[\r\n\x00]/.test(candidate)) return "";
    const digits = candidate.replace(/\D/g, "").length;
    if ((route === "phone" || route === "quote") && /^tel:\+?[0-9][0-9 ()-]{6,24}$/.test(candidate) && digits >= 7 && digits <= 15) return candidate;
    if ((route === "email" || route === "quote") && /^mailto:[^\s@?:]+@[^\s@?:]+\.[^\s@?:]+$/.test(candidate)) return candidate;
    if (!["website", "booking", "whatsapp", "visit", "quote"].includes(route) || !/^https?:\/\//i.test(candidate)) return "";
    try { const url = new URL(candidate); return url.hostname && !url.username && !url.password ? candidate : ""; } catch (_) { return ""; }
  }

  function externalActionCopy(product) {
    const locale = document.documentElement.lang || "en";
    const copy = window.DEMEOSControlledCustomerCopy?.[locale] || window.DEMEOSControlledCustomerCopy?.en;
    const publicCopy = window.DEMEOSPublicCopy?.[locale] || window.DEMEOSPublicCopy?.en;
    if (["phone", "email", "whatsapp"].includes(product.continuationRoute)) return publicCopy?.contact || "Contact";
    if (product.continuationRoute === "quote") return window.DEMEOSItemPresentationCopy?.[locale]?.quote || "Contact business for a quote";
    if (product.continuationRoute === "visit") return window.DEMEOSProductExperienceCopy?.[locale]?.premises || "At the business";
    return product.continuationRoute === "booking" ? copy?.book || "Book with business" : copy?.buy || "Where to buy";
  }

  function isFictionalDiscoverDestination(value) { return ["https://www.demeos.io/customer.html?demeos-test=1#discover","https://demeos.io/customer.html?demeos-test=1#discover"].includes(value); }

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
    const safeDestination = safeContinuation(product, destination);

    action.hidden = true;
    action.removeAttribute("href");
    action.removeAttribute("target");
    action.removeAttribute("rel");
    action.removeAttribute("data-demeos-purchase");
    action.removeAttribute("data-selection-required");
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
    if (/^https?:/i.test(safeDestination)) { action.target = "_blank"; action.rel = "noopener noreferrer"; }
    action.textContent = typeof window !== 'undefined' ? externalActionCopy(product) : routeType === "booking" ? "Book with business" : "Where to buy";
    return true;
  }

  function pauseExperienceVideos(document) {
    if (typeof document.querySelectorAll === "function") document.querySelectorAll("#discover video, #product-experience video").forEach(function (video) { video.pause(); });
  }

  function openProductExperience(document, work, product, destination, navigationOptions = {}) {
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

    if (window.DEMEOSCustomerItemPresentation) window.DEMEOSCustomerItemPresentation.reset(document);
    price.hidden = false;
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
    const preparation=document.getElementById("purchase-preparation");if(preparation)preparation.hidden=true;
    surface.hidden = false;
    surface.setAttribute("data-product-id", text(product.productId));
    surface.setAttribute("data-continuation-type", continuationType(product));
    surface.setAttribute("data-continuation-route", product.continuationRoute);
    if (window.DEMEOSCustomerItemPresentation) window.DEMEOSCustomerItemPresentation.open(document, surface, product, destination, work);
    if (window.DEMEOSCustomerNavigation) window.DEMEOSCustomerNavigation.product(work, product, navigationOptions);
    surface.querySelector(".customer-product-experience-shell").scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
    title.focus({ preventScroll: true });
    return true;
  }

  function closeProductExperience(document) {
    const surface = document.getElementById("product-experience");
    const discover = document.getElementById("discover");
    if (!surface || !discover) return;
    pauseExperienceVideos(document);
    surface.hidden = true;
    if (window.DEMEOSCustomerItemPresentation) window.DEMEOSCustomerItemPresentation.reset(document);
    discover.hidden = false;
    surface.removeAttribute("data-product-id");
    surface.removeAttribute("data-continuation-type");
    if (window.DEMEOSCustomerNavigation) window.DEMEOSCustomerNavigation.returnFromProduct();
    else {
      if (window.location.hash !== "#discover") history.replaceState(null, "", "#discover");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
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
      ...(card.demeosProduct || {}),
      productId: card.getAttribute("data-product-id") || "",
      name: name ? name.textContent : "",
      description: description ? description.textContent : "",
      price: card.demeosProduct ? card.demeosProduct.price || "" : price ? price.textContent : "",
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
    const header = document.querySelector(".customer-header");
    if (header) {
      const sizePurchaseSurface = () => document.documentElement.style.setProperty("--customer-purchase-header-height", header.getBoundingClientRect().height + "px");
      sizePurchaseSurface();
      if (typeof window.ResizeObserver === "function") new window.ResizeObserver(sizePurchaseSurface).observe(header);
      window.addEventListener("resize", sizePurchaseSurface);
    }
    const back = document.getElementById("product-experience-back");
    const action = document.getElementById("product-experience-action");
    if (!back || !action) return;

    back.addEventListener("click", function () { closeProductExperience(document); });
    action.addEventListener("click", function (event) {
      if (action.getAttribute("data-selection-required") === "true") {
        event.preventDefault();
        const missing = Array.from(document.querySelectorAll("#product-experience-options select")).find(select => !select.disabled && !select.value);
        if (missing) {
          missing.scrollIntoView({ block: "center", behavior: "instant" });
          missing.focus({ preventScroll: true });
          const header = document.querySelector(".customer-header");
          const top = (header ? header.getBoundingClientRect().bottom : 0) + 16;
          const bottom = action.getBoundingClientRect().top - 16;
          const rect = missing.getBoundingClientRect();
          const content = document.querySelector("#product-experience .customer-product-experience-shell");
          if (rect.top < top) content.scrollBy({ top: rect.top - top, behavior: "instant" });
          else if (rect.bottom > bottom) content.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
        }
        return;
      }
      if (action.getAttribute("aria-disabled") === "true") { event.preventDefault(); return; }
      if(action.getAttribute("data-demeos-purchase")!=="pending"){
        const selected=window.DEMEOSCustomerItemPresentation&&window.DEMEOSCustomerItemPresentation.snapshot();
        if(selected&&selected.surface.getAttribute("data-controlled-test")==="true"){
          if(isFictionalDiscoverDestination(action.getAttribute("href"))){
            event.preventDefault();const safety=document.getElementById("product-experience-safety");
            if(safety){safety.setAttribute("role","status");safety.setAttribute("tabindex","-1");safety.focus({preventScroll:true});}
            action.hidden=true;
          }
        }
        return;
      }
      event.preventDefault();
      if (window.DEMEOSCustomerPurchasePreparation) { window.DEMEOSCustomerPurchasePreparation.start(); return; }
      action.textContent = "DEMEOS buying is not active yet";
      action.setAttribute("aria-disabled", "true");
    });

    document.addEventListener("click", function (event) {
      const target = event.target && event.target.closest ? event.target.closest(".customer-product-continue-action, .customer-discover-option a, .customer-item-details") : null;
      if (!target) return;
      const card = target.closest(".customer-product-card, .customer-discover-option");
      if (!card) return;
      const product = productFromCard(card);
      if (!product) return;
      const destination = safeContinuation(product, target.getAttribute("data-customer-destination") || target.href);
      event.preventDefault();
      if(window.DEMEOSCustomerPurchasePreparation)window.DEMEOSCustomerPurchasePreparation.cancelPending();
      const workCard = card.closest(".customer-focused-possibility, .customer-work-card, article[data-discover-position]");
      const businessNameNode = workCard && workCard.querySelector ? firstNode(workCard, [".customer-possibility-provider", ".customer-business-name", ".customer-work-business-name"]) : null;
      openProductExperience(document, { businessName: businessNameNode ? businessNameNode.textContent : "", workItemId: workCard ? workCard.getAttribute("data-work-item-id") : "" }, product, destination);
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { isFictionalDiscoverDestination, pauseExperienceVideos, closeProductExperience, availabilityCopy, configureAction, continuationType, openProductExperience, priceCopy, recoverDiscoverIfNeeded, safeHttps, safeContinuation };
  function localizeAction() {
    const surface=document.getElementById('product-experience'),action=document.getElementById('product-experience-action');
    if (!surface || !action || action.hidden || window.DEMEOSCustomerItemPresentation?.snapshot() || surface.getAttribute('data-continuation-route')==='demeos') return;
    action.textContent=externalActionCopy({continuationRoute:surface.getAttribute('data-continuation-route')});
  }
  if (typeof window !== "undefined") window.DEMEOSCustomerProductExperience = Object.freeze({open: openProductExperience, productFromCard, safeContinuation, externalActionCopy, localizeAction});
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () { initialize(document); });
})();
