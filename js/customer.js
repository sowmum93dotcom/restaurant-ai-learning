function addText(document, parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function normalizedRequiredString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

const CUSTOMER_STAGE_ONE_COPY = Object.freeze({
  stageLabel: "Stage 1 · Your intention",
  question: "What would you like to do today?",
  trust: "Tell DEMEOS what you need. You stay in control.",
  intentionLegend: "Choose an intention",
  intentions: Object.freeze([
    "Eat & enjoy", "Take care of myself", "Spend time together",
    "Get something done", "Go somewhere", "Discover something new"
  ]),
  textLabel: "Describe what you need in your own words (optional)",
  textPlaceholder: "For example, I would like a relaxed place to spend time together.",
  locationAction: "Use my location",
  locationAvailable: "Location available for this session.",
  locationOptional: "Location is optional. You can continue without it.",
  continueAction: "Continue",
  continueReady: "Your intention is ready. No information has been sent.",
  missingIntention: "Tell DEMEOS what you need before continuing.",
  changeIntention: "Change what I’m looking for",
  greetings: Object.freeze({ morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" })
});

const CUSTOMER_STAGE_TWO_COPY = Object.freeze({
  stageLabel: "Stage 2 · DEMEOS understands",
  heading: "Here’s what DEMEOS understands.",
  clarificationLabel: "What would you like help getting done?",
  clarificationAction: "Update understanding",
  confirmAction: "Yes, continue",
  changeAction: "Change this",
  foundationTrust: "DEMEOS will use your intention to look for relevant Solution, Participation, Convenience and Experience.",
  confirmed: "DEMEOS understands your intention.",
  saved: "Saved to My Intentions.",
  clarificationRequired: "Add a little more detail so DEMEOS can understand your intention."
});

const CUSTOMER_STAGE_THREE_COPY = Object.freeze({
  stageLabel: "Stage 3 · Your possibilities",
  preparing: "Preparing possibilities connected to what you asked for…",
  found: "Your possibilities",
  introduction: "DEMEOS has brought forward a small set of possibilities around your intention.",
  none: "DEMEOS doesn’t have a sufficiently supported possibility yet.",
  error: "DEMEOS could not prepare possibilities. Please try again.",
  intentionLabel: "Your intention",
  possibilityLabel: "Possibility",
  why: "Why this appeared",
  providedBy: "Provided by",
  continueHeading: "Continue directly with this business",
  continueExplanation: "These routes were provided by the business. Payment and fulfilment stay directly between you and the business.",
  fulfilmentHeading: "How the business says it can fulfil",
  businessProvided: "Business-provided information",
  backAction: "Back to possibilities",
  participateHeading: "Interested in this possibility?",
  participateExplanation: "Interested is an interest signal only. It is not a purchase, booking or sale.",
  participationAction: "Interested",
  participationSuccess: "Interest shared",
  participationConfirmation: "Your interest has been shared with this business.",
  participationError: "DEMEOS could not share your interest. Please try again.",
  saveAction: "Save to My DEMEOS",
  saveExplanation: "Keep this possibility in your DEMEOS relationship.",
  saveSuccess: "Saved to My Possibilities.",
  saveError: "DEMEOS could not save this possibility. Please try again.",
  saveSignInNote: "Enter My DEMEOS if you want to keep this possibility across visits.",
  changeAction: "Change what I’m looking for"
});

const CUSTOMER_NO_POSSIBILITIES_COPY = Object.freeze({
  detailRequired: "Add some detail before continuing.",
  detailTooLong: "Keep your combined detail within 500 characters."
});

const CUSTOMER_STAGE_SIX_COPY = Object.freeze({
  stageLabel: "Stage 6 · Continue with DEMEOS",
  heading: "Help DEMEOS understand better",
  question: "Did this possibility fit what you were looking for?",
  choices: Object.freeze([
    Object.freeze({ label: "Yes, this was relevant", value: "Relevant" }),
    Object.freeze({ label: "Not quite", value: "Not quite" }),
    Object.freeze({ label: "I need something different", value: "Something different" })
  ]),
  commentLabel: "Tell DEMEOS a little more (optional)",
  submitAction: "Share feedback",
  required: "Choose one response before sharing feedback.",
  error: "DEMEOS could not share your feedback. Please try again.",
  success: "Thank you. Your feedback will help DEMEOS understand better.",
  exploreAction: "Explore my possibilities",
  newIntentionAction: "Start with a new intention"
});

function toCustomerPossibility(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const possibilityId = normalizedRequiredString(value.possibilityId);
  const workItemId = normalizedRequiredString(value.workItemId);
  const businessName = normalizedRequiredString(value.businessName);
  const content = normalizedRequiredString(value.content);
  const relevance = value.relevance;
  if (!possibilityId || !workItemId || !businessName || !content || value.participationAction !== "Interested" ||
      !relevance || typeof relevance !== "object" || Array.isArray(relevance) ||
      relevance.basis !== "current-intention-authorized-work" || !Array.isArray(relevance.evidence) ||
      relevance.explanation !== "This authorized possibility connects to your current request." ||
      relevance.evidence.length > 5 || (Object.hasOwn(value, "location") && typeof value.location !== "string")) return null;
  const evidence = relevance.evidence.map(normalizedRequiredString);
  if (!evidence.length || evidence.some(function (term) { return !term || term.length > 60; })) return null;
  const possibility = { possibilityId, workItemId, businessName, content, participationAction: "Interested",
    relevance: { basis: relevance.basis, evidence: evidence.slice(0, 5), explanation: relevance.explanation } };
  if (typeof value.location === "string" && value.location.trim()) possibility.location = value.location.trim();
  const allowedRoutes = ["website", "phone", "whatsapp", "email", "visit", "booking", "quote"];
  const routeDetails = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", visit: "visitAddress", booking: "bookingLink" };
  if (value.customerContinuation && typeof value.customerContinuation === "object" && Array.isArray(value.customerContinuation.routes)) {
    const safe = { routes: [] };
    value.customerContinuation.routes.forEach(function (route) {
      if (!allowedRoutes.includes(route)) return;
      const field = routeDetails[route];
      if (field) {
        const detail = normalizedRequiredString(value.customerContinuation[field]);
        if (!detail) return;
        safe[field] = detail;
      }
      safe.routes.push(route);
    });
    if (value.customerContinuation.quoteVia && safe.routes.includes(value.customerContinuation.quoteVia)) safe.quoteVia = value.customerContinuation.quoteVia;
    if (safe.routes.includes("quote") && !safe.quoteVia) safe.routes = safe.routes.filter(function (route) { return route !== "quote"; });
    if (safe.routes.length) possibility.customerContinuation = safe;
  }
  const allowedFulfilment = ["collection", "delivery", "shipping", "premises", "customer-location", "appointment", "digital"];
  if (value.fulfilment && typeof value.fulfilment === "object" && Array.isArray(value.fulfilment.methods)) {
    const methods = value.fulfilment.methods.filter(function (method) { return allowedFulfilment.includes(method); });
    if (methods.length) {
      possibility.fulfilment = { methods };
      const notes = normalizedRequiredString(value.fulfilment.notes);
      if (notes) possibility.fulfilment.notes = notes;
    }
  }
  if (value.operationalAvailability && typeof value.operationalAvailability === "object" &&
      ["available", "limited", "unavailable", "contact"].includes(value.operationalAvailability.status)) {
    possibility.operationalAvailability = {
      status: value.operationalAvailability.status,
      hoursNotes: normalizedRequiredString(value.operationalAvailability.hoursNotes) || "",
      notes: normalizedRequiredString(value.operationalAvailability.notes) || ""
    };
  }
  if (Array.isArray(value.products)) {
    possibility.products = value.products.filter(function (product) {
      return product && typeof product === "object" && !Array.isArray(product) &&
        normalizedRequiredString(product.productId) && normalizedRequiredString(product.name) &&
        normalizedRequiredString(product.description) &&
        (!product.imageUrl || /^https?:\/\//i.test(product.imageUrl)) &&
        (!product.continuationRoute || (possibility.customerContinuation && possibility.customerContinuation.routes.includes(product.continuationRoute)));
    }).slice(0, 100).map(function (product) {
      const normalized = { productId: product.productId.trim(), name: product.name.trim(), description: product.description.trim(),
        price: normalizedRequiredString(product.price) || "", priceMode: ["fixed", "from", "range"].includes(product.priceMode) ? product.priceMode : "contact",
        imageUrl: normalizedRequiredString(product.imageUrl) || "",
        continuationRoute: normalizedRequiredString(product.continuationRoute) || "",
        availability: ["available", "limited", "unavailable", "contact"].includes(product.availability) ? product.availability : "contact" };
      if (product.fulfilment && Array.isArray(product.fulfilment.methods)) {
        const productMethods = product.fulfilment.methods.filter(function (method) { return allowedFulfilment.includes(method); });
        if (productMethods.length) normalized.fulfilment = { methods: productMethods };
      }
      const productRelevance = product.relevance;
      if (productRelevance && typeof productRelevance === "object" && !Array.isArray(productRelevance) &&
          productRelevance.basis === "current-intention-product-information" && Array.isArray(productRelevance.evidence) &&
          productRelevance.evidence.length > 0 && productRelevance.evidence.length <= 5) {
        const productEvidence = productRelevance.evidence.map(normalizedRequiredString);
        if (productEvidence.every(function (term) { return term && term.length <= 60; })) {
          normalized.relevance = { basis: productRelevance.basis, evidence: productEvidence };
        }
      }
      return normalized;
    });
  }
  if (value.informationSource === "business-provided") possibility.informationSource = "business-provided";
  return possibility;
}

function getValidCustomerPossibilities(possibilities) {
  return Array.isArray(possibilities) ? possibilities.map(toCustomerPossibility).filter(Boolean).slice(0, 5) : [];
}

function renderCustomerPossibilities(document, possibilities, understanding, participationRecorder, feedbackRecorder, continuationActions, saveOptions) {
  const region = document.getElementById("customer-possibilities");
  const heading = document.getElementById("customer-possibilities-heading");
  const list = document.getElementById("customer-possibilities-list");
  const focusRegion = document.getElementById("customer-focused-possibility");
  const intention = document.getElementById("customer-possibility-intention");
  const standardHeader = document.getElementById("customer-possibilities-header");
  const possibilitySpace = region.querySelector ? region.querySelector(".customer-possibility-space") : document.getElementById("customer-possibility-space");
  const changeAction = document.getElementById("customer-change-intention");
  const emptyState = document.getElementById("customer-no-possibilities");
  const valid = getValidCustomerPossibilities(possibilities);
  const confirmed = understanding && understanding.confidenceState === "confirmed" ? understanding : null;
  if (!confirmed) {
    region.hidden = true;
    return;
  }
  region.setAttribute("aria-labelledby", valid.length ? "customer-possibilities-heading" : "customer-no-possibilities-heading");
  list.textContent = "";
  focusRegion.textContent = "";
  focusRegion.hidden = true;
  intention.textContent = "";
  if (standardHeader) standardHeader.hidden = !valid.length;
  if (possibilitySpace) possibilitySpace.hidden = !valid.length;
  if (changeAction) changeAction.hidden = !valid.length;
  if (emptyState) emptyState.hidden = Boolean(valid.length);
  heading.textContent = valid.length ? CUSTOMER_STAGE_THREE_COPY.found : CUSTOMER_STAGE_THREE_COPY.none;
  if (!valid.length) {
    region.hidden = false;
    const detailForm = document.getElementById("customer-add-detail-form");
    const emptyActions = document.getElementById("customer-no-possibilities-actions");
    const detailInput = document.getElementById("customer-add-detail-text");
    if (detailForm) detailForm.hidden = true;
    if (emptyActions) emptyActions.hidden = false;
    if (detailInput) detailInput.value = "";
    const emptyHeading = document.getElementById("customer-no-possibilities-heading");
    if (emptyHeading && typeof emptyHeading.focus === "function") emptyHeading.focus();
    return;
  }
  addText(document, intention, "p", "customer-intention-anchor-label", CUSTOMER_STAGE_THREE_COPY.intentionLabel);
  if (confirmed.intention) addText(document, intention, "h3", "customer-intention-anchor-title", confirmed.intention);
  addText(document, intention, "p", "customer-intention-anchor-summary", confirmed.understanding);
  const logo = document.createElement("img");
  logo.src = "images/demeos-logo.png";
  logo.alt = "";
  logo.className = "customer-space-logo";
  intention.appendChild(logo);

  function showFocused(possibility) {
    list.className = "customer-possibilities-list is-deemphasized";
    focusRegion.textContent = "";
    focusRegion.hidden = false;
    const back = addText(document, focusRegion, "button", "customer-possibility-back", CUSTOMER_STAGE_THREE_COPY.backAction);
    back.type = "button";
    back.addEventListener("click", function () {
      focusRegion.hidden = true;
      focusRegion.textContent = "";
      list.className = "customer-possibilities-list";
      heading.focus();
    });
    addText(document, focusRegion, "p", "customer-possibility-label", CUSTOMER_STAGE_THREE_COPY.possibilityLabel);
    addText(document, focusRegion, "h3", "customer-focused-content", possibility.content);
    addText(document, focusRegion, "h4", "customer-evidence-heading", CUSTOMER_STAGE_THREE_COPY.why);
    addText(document, focusRegion, "p", "customer-possibility-evidence", possibility.relevance.explanation);
    addText(document, focusRegion, "p", "customer-provider-label", CUSTOMER_STAGE_THREE_COPY.providedBy);
    addText(document, focusRegion, "p", "customer-possibility-provider", possibility.businessName);
    if (possibility.location) addText(document, focusRegion, "p", "customer-possibility-location", possibility.location);
    if (Array.isArray(possibility.products) && possibility.products.length) {
      const products = document.createElement("section"); products.className = "customer-product-gallery";
      const galleryHeader = document.createElement("div"); galleryHeader.className = "customer-product-gallery-header";
      const galleryHeading = addText(document, galleryHeader, "h4", "customer-products-heading", "Products & services relevant to your request");
      galleryHeading.id = "customer-products-heading";
      addText(document, galleryHeader, "p", "customer-products-count", possibility.products.length === 1 ? "1 relevant product or service" : possibility.products.length + " relevant products & services");
      products.appendChild(galleryHeader);
      const grid = document.createElement("div"); grid.className = "customer-product-grid"; grid.setAttribute("role", "list"); grid.setAttribute("aria-labelledby", "customer-products-heading");
      possibility.products.forEach(function (product) {
        const card = document.createElement("article"); card.className = "customer-product-card";
        card.setAttribute("role", "listitem"); card.setAttribute("data-product-id", product.productId);
        const route = product.continuationRoute;
        const field = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink", visit: "visitAddress" }[route];
        const detail = possibility.customerContinuation && field ? possibility.customerContinuation[field] : null;
        let href = null;
        if ((route === "website" || route === "booking") && /^https?:\/\//i.test(detail)) href = detail;
        else if (route === "phone" && detail) href = "tel:" + detail;
        else if (route === "whatsapp" && detail) href = /^https?:\/\//i.test(detail) ? detail : "https://wa.me/" + detail.replace(/\D/g, "");
        else if (route === "email" && detail) href = "mailto:" + detail;
        else if (route === "visit" && detail) href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(detail);
        else if (route === "quote" && possibility.customerContinuation && possibility.customerContinuation.quoteVia) {
          const quoteRoute = possibility.customerContinuation.quoteVia;
          const quoteField = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink" }[quoteRoute];
          const quoteDetail = quoteField ? possibility.customerContinuation[quoteField] : null;
          if (quoteRoute === "email" && quoteDetail) href = "mailto:" + quoteDetail;
          else if (quoteRoute === "phone" && quoteDetail) href = "tel:" + quoteDetail;
          else if (quoteRoute === "whatsapp" && quoteDetail) href = /^https?:\/\//i.test(quoteDetail) ? quoteDetail : "https://wa.me/" + quoteDetail.replace(/\D/g, "");
          else if ((quoteRoute === "website" || quoteRoute === "booking") && /^https?:\/\//i.test(quoteDetail)) href = quoteDetail;
        }
        if (product.availability === "unavailable") href = null;
        if (product.imageUrl) {
          const imageFrame = document.createElement("div"); imageFrame.className = "customer-product-image-frame";
          const image = document.createElement("img"); image.alt = product.name; image.loading = "lazy"; image.decoding = "async";
          let imageContainer = imageFrame;
          if (href) {
            const imageLink = document.createElement("a"); imageLink.href = href; imageLink.setAttribute("aria-label", product.name + " — continue with " + possibility.businessName);
            if (/^https?:\/\//i.test(href)) { imageLink.target = "_blank"; imageLink.rel = "noopener noreferrer"; }
            imageLink.appendChild(image); imageFrame.appendChild(imageLink);
            imageContainer = imageLink;
          } else imageFrame.appendChild(image);
          image.addEventListener("error", function () {
            imageContainer.textContent = "";
            const unavailableImage = addText(document, imageContainer, "div", "customer-product-no-image", "Image unavailable. Product information is shown below.");
            unavailableImage.setAttribute("aria-label", "The business-provided image for " + product.name + " could not be loaded");
          }, { once: true });
          image.src = product.imageUrl;
          card.appendChild(imageFrame);
        } else {
          const noImage = addText(document, card, "div", "customer-product-no-image", "Product information available");
          noImage.setAttribute("aria-label", product.name + " has no business-provided image");
        }
        addText(document, card, "h5", "customer-product-name", product.name);
        addText(document, card, "p", "customer-product-description", product.description);
        const productPriceText = product.priceMode === "contact" ? "Contact business for price" :
          product.priceMode === "from" ? "From " + product.price :
          product.priceMode === "range" ? "Price range: " + product.price : product.price;
        if (productPriceText) addText(document, card, "p", "customer-product-price", productPriceText);
        const productAvailabilityLabels = { available: "Available", limited: "Limited availability — contact the business first", unavailable: "Not currently available", contact: "Contact the business to confirm availability" };
        addText(document, card, "p", "customer-product-availability", productAvailabilityLabels[product.availability]);
        if (product.relevance && Array.isArray(product.relevance.evidence) && product.relevance.evidence.length) {
          addText(document, card, "p", "customer-product-relevance", "Relevant to your request: " + product.relevance.evidence.join(", ") + ".");
        }
        if (product.fulfilment && product.fulfilment.methods.length) {
          const productFulfilmentLabels = { collection: "Collection", delivery: "Delivery", shipping: "Shipping", premises: "At the business", "customer-location": "At your location", appointment: "Appointment", digital: "Digital" };
          addText(document, card, "p", "customer-product-fulfilment", "How you receive it: " + product.fulfilment.methods.map(function (method) { return productFulfilmentLabels[method]; }).join(" · "));
        }
        addText(document, card, "p", "customer-product-source", "Image and product information provided by " + possibility.businessName + ".");
        const controls = document.createElement("div"); controls.className = "customer-product-controls";
        const detailButton = document.createElement("button"); detailButton.type = "button"; detailButton.className = "customer-product-detail-button"; detailButton.textContent = "View details";
        const details = document.createElement("div"); details.className = "customer-product-details"; details.hidden = true;
        addText(document, details, "p", "customer-product-detail-description", product.description);
        addText(document, details, "p", "customer-product-detail-trust", "This product is shown because its business-provided information connects to your current request. Viewing it is not recorded as interest or a purchase.");
        if (product.availability !== "unavailable" && href) {
          const continueAction = document.createElement("a"); continueAction.className = "customer-product-continue-action"; continueAction.href = href;
          continueAction.textContent = product.availability === "limited" || product.availability === "contact" ? "Contact " + possibility.businessName : "Continue with " + possibility.businessName;
          if (/^https?:\/\//i.test(href)) { continueAction.target = "_blank"; continueAction.rel = "noopener noreferrer"; }
          details.appendChild(continueAction);
        } else if (product.availability === "unavailable") {
          addText(document, details, "p", "customer-product-unavailable-note", "This business says this product is not currently available.");
        }
        detailButton.setAttribute("aria-expanded", "false");
        detailButton.addEventListener("click", function () {
          const opening = details.hidden; details.hidden = !opening; detailButton.setAttribute("aria-expanded", opening ? "true" : "false");
          detailButton.textContent = opening ? "Hide details" : "View details";
        });
        controls.appendChild(detailButton); card.appendChild(controls); card.appendChild(details);
        grid.appendChild(card);
      });
      products.appendChild(grid); focusRegion.appendChild(products);
    }
    if (possibility.customerContinuation) {
      const continuation = document.createElement("section");
      continuation.className = "customer-business-continuation";
      addText(document, continuation, "h4", "customer-continuation-heading", CUSTOMER_STAGE_THREE_COPY.continueHeading);
      addText(document, continuation, "p", "customer-continuation-copy", CUSTOMER_STAGE_THREE_COPY.continueExplanation);
      const actions = document.createElement("div");
      actions.className = "customer-continuation-actions";
      const labels = { website: "Visit website", phone: "Call", whatsapp: "WhatsApp", email: "Email", visit: "Visit business", booking: "Book / order", quote: "Request quote / enquiry" };
      possibility.customerContinuation.routes.forEach(function (route) {
        const field = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", visit: "visitAddress", booking: "bookingLink" }[route];
        const detail = field ? possibility.customerContinuation[field] : null;
        let href = null;
        if ((route === "website" || route === "booking") && /^https?:\/\//i.test(detail)) href = detail;
        else if (route === "phone") href = "tel:" + detail;
        else if (route === "whatsapp") href = /^https?:\/\//i.test(detail) ? detail : "https://wa.me/" + detail.replace(/\D/g, "");
        else if (route === "email") href = "mailto:" + detail;
        else if (route === "visit" && detail) href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(detail);
        else if (route === "quote" && possibility.customerContinuation.quoteVia) {
          const quoteRoute = possibility.customerContinuation.quoteVia;
          const quoteField = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink" }[quoteRoute];
          const quoteDetail = quoteField ? possibility.customerContinuation[quoteField] : null;
          if (quoteRoute === "email") href = "mailto:" + quoteDetail;
          else if (quoteRoute === "phone") href = "tel:" + quoteDetail;
          else if (quoteRoute === "whatsapp") href = /^https?:\/\//i.test(quoteDetail) ? quoteDetail : "https://wa.me/" + quoteDetail.replace(/\D/g, "");
          else if ((quoteRoute === "website" || quoteRoute === "booking") && /^https?:\/\//i.test(quoteDetail)) href = quoteDetail;
        }
        const action = document.createElement(href ? "a" : "span");
        action.className = href ? "customer-continuation-action" : "customer-continuation-note";
        action.textContent = labels[route];
        if (href) {
          action.href = href;
          if (route === "website" || route === "booking" || route === "whatsapp" || route === "visit") {
            action.target = "_blank";
            action.rel = "noopener noreferrer";
          }
        }
        actions.appendChild(action);
      });
      continuation.appendChild(actions);
      if (possibility.operationalAvailability) {
        const availabilityLabels = { available: "Available for new customer enquiries", limited: "Limited availability — contact the business first", unavailable: "Not currently available for new enquiries", contact: "Contact the business to confirm availability" };
        addText(document, continuation, "p", "customer-availability-status", availabilityLabels[possibility.operationalAvailability.status]);
        if (possibility.operationalAvailability.hoursNotes) addText(document, continuation, "p", "customer-business-hours", possibility.operationalAvailability.hoursNotes);
        if (possibility.operationalAvailability.notes) addText(document, continuation, "p", "customer-availability-notes", possibility.operationalAvailability.notes);
      }
      if (possibility.fulfilment) {
        addText(document, continuation, "h5", "customer-fulfilment-heading", CUSTOMER_STAGE_THREE_COPY.fulfilmentHeading);
        addText(document, continuation, "p", "customer-fulfilment-methods", possibility.fulfilment.methods.map(function (method) {
          return ({ collection: "Collection", delivery: "Delivery", shipping: "Shipping", premises: "At the business", "customer-location": "At your location", appointment: "Appointment", digital: "Digital" })[method];
        }).join(" · "));
        if (possibility.fulfilment.notes) addText(document, continuation, "p", "customer-fulfilment-notes", possibility.fulfilment.notes);
      }
      if (possibility.informationSource === "business-provided") addText(document, continuation, "p", "customer-information-source", CUSTOMER_STAGE_THREE_COPY.businessProvided);
      focusRegion.appendChild(continuation);
    }
    const save = document.createElement("section");
    save.className = "customer-possibility-save";
    if (saveOptions && saveOptions.authenticated === true) {
      addText(document, save, "p", "customer-possibility-save-copy", CUSTOMER_STAGE_THREE_COPY.saveExplanation);
      const saveButton = addText(document, save, "button", "customer-possibility-save-button", CUSTOMER_STAGE_THREE_COPY.saveAction);
      saveButton.type = "button";
      const saveStatus = addText(document, save, "p", "customer-possibility-save-status", "");
      saveStatus.setAttribute("aria-live", "polite");
      saveButton.addEventListener("click", async function () {
        saveButton.disabled = true;
        try {
          await (saveOptions.record || saveCustomerPossibility)(possibility);
          saveStatus.textContent = CUSTOMER_STAGE_THREE_COPY.saveSuccess;
        } catch (_error) {
          saveButton.disabled = false;
          saveStatus.textContent = CUSTOMER_STAGE_THREE_COPY.saveError;
        }
      });
    } else {
      addText(document, save, "p", "customer-possibility-save-note", CUSTOMER_STAGE_THREE_COPY.saveSignInNote);
    }
    focusRegion.appendChild(save);
    const participation = document.createElement("section");
    participation.className = "customer-focused-participation";
    addText(document, participation, "h4", "customer-participation-title", CUSTOMER_STAGE_THREE_COPY.participateHeading);
    addText(document, participation, "p", "customer-participation-copy", CUSTOMER_STAGE_THREE_COPY.participateExplanation);
    const action = addText(document, participation, "button", "customer-participation-button", CUSTOMER_STAGE_THREE_COPY.participationAction);
    action.type = "button";
    const result = addText(document, participation, "p", "customer-participation-confirmation", "");
    result.setAttribute("aria-live", "polite");
    action.addEventListener("click", async function () {
      action.disabled = true;
      try {
        await (participationRecorder || recordParticipation)(possibility);
        action.textContent = CUSTOMER_STAGE_THREE_COPY.participationSuccess;
        result.textContent = CUSTOMER_STAGE_THREE_COPY.participationConfirmation;
      } catch (error) {
        action.disabled = false;
        result.textContent = CUSTOMER_STAGE_THREE_COPY.participationError;
      }
    });
    focusRegion.appendChild(participation);

    const feedback = document.createElement("section");
    feedback.className = "customer-feedback";
    addText(document, feedback, "p", "customer-stage-label", CUSTOMER_STAGE_SIX_COPY.stageLabel);
    addText(document, feedback, "h4", "customer-feedback-heading", CUSTOMER_STAGE_SIX_COPY.heading);
    const form = document.createElement("form");
    form.className = "customer-feedback-form";
    const choices = document.createElement("fieldset");
    const legend = addText(document, choices, "legend", "customer-feedback-question", CUSTOMER_STAGE_SIX_COPY.question);
    legend.id = "customer-feedback-question-" + possibility.possibilityId;
    CUSTOMER_STAGE_SIX_COPY.choices.forEach(function (choice, index) {
      const label = document.createElement("label");
      label.className = "customer-feedback-choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "customer-feedback-response";
      input.value = choice.value;
      input.required = index === 0;
      label.appendChild(input);
      addText(document, label, "span", "", choice.label);
      choices.appendChild(label);
    });
    form.appendChild(choices);
    const commentLabel = addText(document, form, "label", "customer-feedback-comment-label", CUSTOMER_STAGE_SIX_COPY.commentLabel);
    const comment = document.createElement("textarea");
    comment.rows = 3;
    comment.maxLength = 500;
    comment.id = "customer-feedback-comment-" + possibility.possibilityId;
    commentLabel.setAttribute("for", comment.id);
    form.appendChild(comment);
    const submit = addText(document, form, "button", "customer-feedback-submit", CUSTOMER_STAGE_SIX_COPY.submitAction);
    submit.type = "submit";
    const feedbackResult = addText(document, form, "p", "customer-feedback-result", "");
    feedbackResult.setAttribute("aria-live", "polite");
    feedbackResult.setAttribute("tabindex", "-1");
    const continueActions = document.createElement("div");
    continueActions.className = "customer-feedback-continuations";
    continueActions.hidden = true;
    const explore = addText(document, continueActions, "button", "customer-feedback-explore", CUSTOMER_STAGE_SIX_COPY.exploreAction);
    explore.type = "button";
    const restart = addText(document, continueActions, "button", "customer-feedback-restart", CUSTOMER_STAGE_SIX_COPY.newIntentionAction);
    restart.type = "button";
    explore.addEventListener("click", function () {
      if (continuationActions && continuationActions.explore) continuationActions.explore();
      else if (typeof back.click === "function") back.click();
    });
    restart.addEventListener("click", function () {
      if (continuationActions && continuationActions.restart) continuationActions.restart();
    });
    form.appendChild(continueActions);
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const selected = choices.children.map ? choices.children.map(function (label) { return label.children[0]; }).find(function (input) { return input.checked; })
        : Array.from(choices.querySelectorAll("input[type=radio]")).find(function (input) { return input.checked; });
      if (!selected) { feedbackResult.textContent = CUSTOMER_STAGE_SIX_COPY.required; return; }
      submit.disabled = true;
      try {
        await (feedbackRecorder || recordCustomerFeedback)(possibility, { response: selected.value, comment: comment.value || "" });
        feedbackResult.textContent = CUSTOMER_STAGE_SIX_COPY.success;
        continueActions.hidden = false;
        choices.disabled = true;
        comment.disabled = true;
        if (typeof feedbackResult.focus === "function") feedbackResult.focus();
      } catch (error) {
        submit.disabled = false;
        feedbackResult.textContent = CUSTOMER_STAGE_SIX_COPY.error;
      }
    });
    feedback.appendChild(form);
    focusRegion.appendChild(feedback);
    focusRegion.setAttribute("aria-label", CUSTOMER_STAGE_THREE_COPY.possibilityLabel + ": " + possibility.content);
    if (typeof focusRegion.focus === "function") focusRegion.focus();
  }

  valid.forEach(function (possibility, index) {
    const surface = document.createElement("button");
    surface.type = "button";
    surface.className = "customer-possibility-surface customer-possibility-position-" + (index + 1);
    surface.setAttribute("aria-label", CUSTOMER_STAGE_THREE_COPY.possibilityLabel + ": " + possibility.content);
    addText(document, surface, "span", "customer-possibility-label", CUSTOMER_STAGE_THREE_COPY.possibilityLabel);
    const imageProducts = Array.isArray(possibility.products) ? possibility.products.filter(function (product) { return product.imageUrl; }) : [];
    if (imageProducts.length) {
      const preview = document.createElement("span"); preview.className = "customer-possibility-product-preview";
      imageProducts.slice(0, 3).forEach(function (product) {
        const image = document.createElement("span"); image.className = "customer-possibility-product-image-ready";
        image.setAttribute("aria-hidden", "true");
        preview.appendChild(image);
      });
      surface.appendChild(preview);
      addText(document, surface, "span", "customer-possibility-product-count", imageProducts.length === 1 ? "1 relevant product image" : imageProducts.length + " relevant product images");
    }
    addText(document, surface, "span", "customer-possibility-preview", possibility.content);
    addText(document, surface, "span", "customer-possibility-provider", CUSTOMER_STAGE_THREE_COPY.providedBy + " " + possibility.businessName);
    surface.addEventListener("click", function () { showFocused(possibility); });
    list.appendChild(surface);
  });
  region.hidden = false;
  heading.focus();
}

async function requestCustomerPossibilities(document, understanding, fetcher, continuationActions) {
  const region = document.getElementById("customer-possibilities");
  const heading = document.getElementById("customer-possibilities-heading");
  region.hidden = false;
  heading.textContent = CUSTOMER_STAGE_THREE_COPY.preparing;
  try {
    const currentIntention = { intention: understanding.intention, customerText: understanding.customerText,
      understanding: understanding.understanding, source: understanding.source,
      confidenceState: understanding.confidenceState };
    const response = await fetcher("/api/customer/possibilities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ understanding: currentIntention })
    });
    const data = await response.json();
    if (!response.ok || !data || !Array.isArray(data.possibilities)) throw new Error();
    let authenticated = false;
    try {
      const identityResponse = await fetcher("/api/customer/identity", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const identity = identityResponse.ok ? await identityResponse.json() : null;
      authenticated = Boolean(identity && identity.authenticated === true);
    } catch (_error) { authenticated = false; }
    renderCustomerPossibilities(document, data.possibilities, understanding, recordParticipation,
      recordCustomerFeedback, continuationActions, { authenticated, record: saveCustomerPossibility });
  } catch (error) {
    heading.textContent = CUSTOMER_STAGE_THREE_COPY.error;
  }
}

async function saveCustomerPossibility(possibility) {
  const workItemId = possibility && normalizedRequiredString(possibility.workItemId);
  if (!workItemId) throw new Error(CUSTOMER_STAGE_THREE_COPY.saveError);
  const response = await fetch("/api/customer/possibilities/saved", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workItemId })
  });
  if (!response.ok) throw new Error(CUSTOMER_STAGE_THREE_COPY.saveError);
}

async function recordCustomerFeedback(work, feedback) {
  const workItemId = work && normalizedRequiredString(work.workItemId);
  const allowed = CUSTOMER_STAGE_SIX_COPY.choices.map(function (choice) { return choice.value; });
  if (!workItemId || !feedback || !allowed.includes(feedback.response) || typeof feedback.comment !== "string" || feedback.comment.length > 500) {
    throw new Error(CUSTOMER_STAGE_SIX_COPY.error);
  }
  const body = { response: feedback.response };
  if (feedback.comment.trim()) body.comment = feedback.comment.trim();
  const response = await fetch(`/api/customer/work/${encodeURIComponent(workItemId)}/feedback`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(CUSTOMER_STAGE_SIX_COPY.error);
}

function getLocalGreeting(value) {
  const hour = value instanceof Date ? value.getHours() : Number(value);
  if (Number.isFinite(hour) && hour >= 5 && hour < 12) return CUSTOMER_STAGE_ONE_COPY.greetings.morning;
  if (Number.isFinite(hour) && hour >= 12 && hour < 18) return CUSTOMER_STAGE_ONE_COPY.greetings.afternoon;
  return CUSTOMER_STAGE_ONE_COPY.greetings.evening;
}

function getPreferredLanguage(navigatorValue) {
  if (!navigatorValue || typeof navigatorValue !== "object") return "en";
  const languages = Array.isArray(navigatorValue.languages) ? navigatorValue.languages : [];
  return normalizedRequiredString(languages[0]) || normalizedRequiredString(navigatorValue.language) || "en";
}

function normalizedCustomerIntention(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function selectCustomerIntention(value) {
  return CUSTOMER_STAGE_ONE_COPY.intentions.includes(value) ? value : "";
}

function requestCustomerLocation(geolocation, onState) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
    onState("optional");
    return;
  }
  geolocation.getCurrentPosition(function () { onState("available"); }, function () { onState("optional"); });
}

function initializeCustomerIntention(document, navigatorValue, now) {
  const greeting = document.getElementById("customer-greeting");
  if (!greeting) return;
  document.querySelectorAll("[data-stage-copy]").forEach(function (element) {
    element.textContent = CUSTOMER_STAGE_ONE_COPY[element.getAttribute("data-stage-copy")] || "";
  });
  document.querySelectorAll("[data-stage-placeholder]").forEach(function (element) {
    element.setAttribute("placeholder", CUSTOMER_STAGE_ONE_COPY[element.getAttribute("data-stage-placeholder")] || "");
  });
  greeting.textContent = getLocalGreeting(now || new Date());
  document.documentElement.dataset.preferredLanguage = getPreferredLanguage(navigatorValue);

  const options = document.getElementById("customer-intention-options");
  let selectedIntention = "";
  let currentUnderstanding = null;
  const understandingPanel = document.getElementById("customer-understanding");
  const intentionForm = document.getElementById("customer-intention-form");
  document.querySelectorAll("[data-understanding-copy]").forEach(function (element) {
    element.textContent = CUSTOMER_STAGE_TWO_COPY[element.getAttribute("data-understanding-copy")] || "";
  });
  document.querySelectorAll("[data-possibilities-copy]").forEach(function (element) {
    element.textContent = CUSTOMER_STAGE_THREE_COPY[element.getAttribute("data-possibilities-copy")] || "";
  });

  function changeIntention() {
    currentUnderstanding = null;
    const possibilityRegion = document.getElementById("customer-possibilities");
    possibilityRegion.hidden = true;
    document.getElementById("customer-possibilities-list").textContent = "";
    document.getElementById("customer-focused-possibility").textContent = "";
    document.getElementById("customer-focused-possibility").hidden = true;
    document.getElementById("customer-possibility-intention").textContent = "";
    document.getElementById("customer-add-detail-form").hidden = true;
    document.getElementById("customer-no-possibilities-actions").hidden = false;
    document.getElementById("customer-add-detail-text").value = "";
    understandingPanel.hidden = true;
    document.getElementById("customer-intention-save").hidden = true;
    document.getElementById("customer-intention-sign-in-note").hidden = true;
    document.getElementById("customer-intention-save-button").disabled = false;
    document.getElementById("customer-intention-save-status").textContent = "";
    intentionForm.hidden = false;
    document.getElementById("customer-understanding-status").textContent = "";
    document.getElementById("customer-intention-text").focus();
  }

  async function showUnderstanding(clarificationText) {
    const customerText = document.getElementById("customer-intention-text").value;
    currentUnderstanding = globalThis.CustomerUnderstanding.buildCustomerUnderstanding(
      selectedIntention, customerText, clarificationText);
    if (!currentUnderstanding) {
      document.getElementById("customer-intention-status").textContent = CUSTOMER_STAGE_ONE_COPY.missingIntention;
      return;
    }
    try {
      const response = await fetch("/api/customer/understanding", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          intention: selectedIntention, customerText, clarificationText: clarificationText || ""
        }) });
      const data = response.ok ? await response.json() : null;
      if (data && data.understanding) currentUnderstanding = data.understanding;
    } catch (_error) { /* The existing anonymous, intention-first flow remains available. */ }
    document.getElementById("customer-understanding-summary").textContent = currentUnderstanding.understanding;
    const needsClarification = currentUnderstanding.confidenceState === "needs-clarification";
    document.getElementById("customer-clarification").hidden = !needsClarification;
    document.getElementById("customer-understanding-actions").hidden = needsClarification;
    document.getElementById("customer-understanding-confirm").hidden = false;
    document.getElementById("customer-understanding-status").textContent = needsClarification ? CUSTOMER_STAGE_TWO_COPY.clarificationRequired : "";
    intentionForm.hidden = true;
    understandingPanel.hidden = false;
    document.getElementById("customer-understanding-heading").focus();
  }
  CUSTOMER_STAGE_ONE_COPY.intentions.forEach(function (label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "customer-intention-option";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", function () {
      selectedIntention = selectCustomerIntention(label);
      Array.from(options.children).forEach(function (option) {
        option.setAttribute("aria-pressed", String(option === button));
      });
    });
    options.appendChild(button);
  });

  const locationStatus = document.getElementById("customer-location-status");
  document.getElementById("customer-location-button").addEventListener("click", function () {
    requestCustomerLocation(navigatorValue && navigatorValue.geolocation, function (state) {
      locationStatus.textContent = state === "available" ? CUSTOMER_STAGE_ONE_COPY.locationAvailable : CUSTOMER_STAGE_ONE_COPY.locationOptional;
    });
  });
  intentionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const freeText = normalizedCustomerIntention(document.getElementById("customer-intention-text").value);
    document.getElementById("customer-intention-status").textContent = (selectedIntention || freeText) ? "" : CUSTOMER_STAGE_ONE_COPY.missingIntention;
    if (selectedIntention || freeText) showUnderstanding("");
  });
  document.getElementById("customer-clarification-button").addEventListener("click", function () {
    const detail = normalizedCustomerIntention(document.getElementById("customer-clarification-text").value);
    if (detail) showUnderstanding(detail);
  });
  document.getElementById("customer-understanding-change").addEventListener("click", function () {
    changeIntention();
  });
  document.getElementById("customer-change-intention").addEventListener("click", changeIntention);
  document.getElementById("customer-empty-change-intention").addEventListener("click", changeIntention);
  document.getElementById("customer-add-detail").addEventListener("click", function () {
    document.getElementById("customer-no-possibilities-actions").hidden = true;
    document.getElementById("customer-add-detail-form").hidden = false;
    document.getElementById("customer-add-detail-text").focus();
  });
  document.getElementById("customer-add-detail-cancel").addEventListener("click", function () {
    document.getElementById("customer-add-detail-form").hidden = true;
    document.getElementById("customer-no-possibilities-actions").hidden = false;
    document.getElementById("customer-add-detail").focus();
  });
  document.getElementById("customer-add-detail-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const input = document.getElementById("customer-add-detail-text");
    const addedDetail = normalizedCustomerIntention(input.value);
    if (!addedDetail) {
      document.getElementById("customer-add-detail-status").textContent = CUSTOMER_NO_POSSIBILITIES_COPY.detailRequired;
      return;
    }
    const previousEvidence = currentUnderstanding && normalizedCustomerIntention(currentUnderstanding.customerText);
    const combinedEvidence = [previousEvidence, addedDetail].filter(Boolean).join(" ");
    if (combinedEvidence.length > 500) {
      document.getElementById("customer-add-detail-status").textContent = CUSTOMER_NO_POSSIBILITIES_COPY.detailTooLong;
      return;
    }
    document.getElementById("customer-intention-text").value = combinedEvidence;
    document.getElementById("customer-possibilities").hidden = true;
    document.getElementById("customer-add-detail-status").textContent = "";
    showUnderstanding("");
  });
  document.getElementById("customer-understanding-confirm").addEventListener("click", function () {
    currentUnderstanding = globalThis.CustomerUnderstanding.confirmCustomerUnderstanding(currentUnderstanding);
    if (!currentUnderstanding) return;
    document.getElementById("customer-understanding-confirm").hidden = true;
    document.getElementById("customer-understanding-status").textContent = CUSTOMER_STAGE_TWO_COPY.confirmed;
    document.getElementById("customer-understanding-change").hidden = false;
    const saveArea = document.getElementById("customer-intention-save");
    const signInNote = document.getElementById("customer-intention-sign-in-note");
    const saveButton = document.getElementById("customer-intention-save-button");
    fetch("/api/customer/identity", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : { authenticated: false }; })
      .then(function (identity) { saveArea.hidden = identity.authenticated !== true; signInNote.hidden = identity.authenticated === true; })
      .catch(function () { signInNote.hidden = false; });
    saveButton.onclick = async function () {
      if (saveButton.disabled || !currentUnderstanding || currentUnderstanding.confidenceState !== "confirmed") return;
      saveButton.disabled = true;
      try {
        const response = await fetch("/api/customer/intentions", { method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intention: currentUnderstanding.intention,
            customerText: currentUnderstanding.customerText, understanding: currentUnderstanding.understanding }) });
        if (response.ok) document.getElementById("customer-intention-save-status").textContent = CUSTOMER_STAGE_TWO_COPY.saved;
        else saveButton.disabled = false;
      } catch (_error) { saveButton.disabled = false; }
    };
    understandingPanel.hidden = true;
    requestCustomerPossibilities(document, currentUnderstanding, globalThis.fetch, {
      explore: function () {
        document.getElementById("customer-focused-possibility").hidden = true;
        document.getElementById("customer-focused-possibility").textContent = "";
        document.getElementById("customer-possibilities-list").className = "customer-possibilities-list";
        document.getElementById("customer-possibilities-heading").focus();
      },
      restart: changeIntention
    });
  });
}

function toCustomerWorkItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const workItemId = normalizedRequiredString(item.workItemId);
  const businessName = normalizedRequiredString(item.businessName);
  const content = normalizedRequiredString(item.content);
  if (!workItemId || !businessName || !content || item.participationAction !== "Interested") return null;

  const publicItem = { workItemId, businessName, content, participationAction: "Interested" };
  if (typeof item.location === "string" && item.location.trim()) publicItem.location = item.location.trim();
  if (Array.isArray(item.media)) {
    publicItem.media = item.media.filter(function (asset) {
      return asset && typeof asset === "object" && ["image", "video"].includes(asset.kind) &&
        ["primary", "supporting"].includes(asset.role) && /^https:\/\//i.test(asset.deliveryUrl || "");
    }).slice(0, 10).map(function (asset) {
      return { assetId: normalizedRequiredString(asset.assetId) || "", kind: asset.kind, role: asset.role,
        deliveryUrl: asset.deliveryUrl, contentType: normalizedRequiredString(asset.contentType) || "" };
    });
  }
  return publicItem;
}

function getValidCustomerWork(work) {
  if (!Array.isArray(work)) return [];
  return work.map(toCustomerWorkItem).filter(Boolean);
}

function createCustomerWorkCard(document, work, customerPackages, recordParticipation, anchorJourney) {
  const card = document.createElement("article");
  card.className = "customer-work-card";

  const context = document.createElement("header");
  context.className = "customer-work-context";
  if (anchorJourney) context.id = "understand";
  const identity = document.createElement("div");
  addText(document, identity, "p", "customer-step", "02 · Understand");
  addText(document, identity, "h3", "customer-business-name", work.businessName);
  if (work.location) addText(document, identity, "p", "customer-work-location", work.location);
  context.appendChild(identity);
  addText(document, context, "span", "customer-approved-mark", "Approved for customers");

  const message = document.createElement("section");
  message.className = "customer-message";
  message.setAttribute("aria-label", `Message from ${work.businessName}`);
  addText(document, message, "p", "customer-message-label", "Customer message");
  addText(document, message, "p", "customer-work-content", work.content);

  if (Array.isArray(work.media) && work.media.length) {
    const mediaRegion = document.createElement("div");
    mediaRegion.className = "customer-work-media";
    work.media.forEach(function (asset) {
      const media = asset.kind === "video" ? document.createElement("video") : document.createElement("img");
      media.className = "customer-work-media-item " + (asset.role === "primary" ? "is-primary" : "is-supporting");
      media.src = asset.deliveryUrl;
      if (asset.kind === "video") { media.controls = true; media.preload = "metadata"; media.playsInline = true; }
      else media.alt = `Approved media from ${work.businessName}`;
      mediaRegion.appendChild(media);
    });
    message.appendChild(mediaRegion);
  }

  const choice = document.createElement("section");
  choice.className = "customer-choice";
  if (anchorJourney) choice.id = "choose";
  addText(document, choice, "p", "customer-step", "03 · Choose");
  addText(document, choice, "h4", "customer-choice-title", "Customer options");
  const packageRegion = document.createElement("div");
  packageRegion.className = "customer-package-region";
  packageRegion.setAttribute("aria-live", "polite");
  if (!customerPackages.length) {
    addText(document, packageRegion, "p", "customer-package-empty", "Customer options will appear here when available.");
  }
  choice.appendChild(packageRegion);

  const participation = document.createElement("section");
  participation.className = "customer-participation";
  if (anchorJourney) participation.id = "participate";
  const participationCopy = document.createElement("div");
  addText(document, participationCopy, "p", "customer-step", "04 · Participate");
  addText(document, participationCopy, "h4", "customer-participation-title", "Interested in this work?");
  addText(document, participationCopy, "p", "customer-participation-copy", "Interested is an interest signal only. It is not a purchase, booking or sale.");
  const action = document.createElement("button");
  action.className = "customer-participation-button";
  action.textContent = work.participationAction;
  action.type = "button";
  participation.append(participationCopy, action);

  const result = document.createElement("p");
  result.className = "customer-participation-confirmation";
  result.setAttribute("aria-live", "polite");
  action.addEventListener("click", async function () {
    action.disabled = true;
    try {
      await recordParticipation(work);
      action.textContent = "Interest shared";
      result.textContent = "Thank you. Your participation signal has been shared with this business.";
      card.className += " is-participating";
    } catch (error) {
      action.disabled = false;
      result.textContent = error.message;
    }
  });

  card.append(context, message, choice, participation, result);
  return card;
}

async function recordParticipation(work) {
  const workItemId = work && normalizedRequiredString(work.workItemId);
  if (!workItemId || work.participationAction !== "Interested") {
    throw new Error("DEMEOS could not share your interest. Please try again.");
  }
  const response = await fetch(`/api/customer/work/${encodeURIComponent(workItemId)}/participation`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "Interested" })
  });
  if (!response.ok) throw new Error("DEMEOS could not share your interest. Please try again.");
}

function renderCustomerWork(document, work, customerPackages, participationRecorder) {
  const status = document.getElementById("customer-work-status");
  const list = document.getElementById("customer-work-list");
  list.textContent = "";
  const validWork = getValidCustomerWork(work);
  const validPackages = Array.isArray(customerPackages) ? customerPackages : [];
  if (!validWork.length) {
    status.className = "customer-empty-state";
    status.innerHTML = "<strong>Nothing to discover just yet</strong><span>No approved customer work is available. Please check back soon.</span>";
    return;
  }
  status.textContent = "";
  status.className = "customer-work-status";
  validWork.forEach(function (item, index) {
    list.appendChild(createCustomerWorkCard(document, item, validPackages, participationRecorder, index === 0));
  });
}

function getServerCustomerPackages(data) {
  return Array.isArray(data.customerPackages) ? data.customerPackages : [];
}

async function loadCustomerWork(document, fetcher) {
  const status = document.getElementById("customer-work-status");
  try {
    const response = await fetcher("/api/customer/work");
    const data = await response.json();
    if (!response.ok || !data || !Array.isArray(data.work)) throw new Error();
    renderCustomerWork(document, data.work, getServerCustomerPackages(data), recordParticipation);
  } catch (error) {
    status.className = "customer-empty-state customer-load-error";
    status.textContent = "DEMEOS could not load approved work. Please try again.";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CUSTOMER_STAGE_ONE_COPY, CUSTOMER_STAGE_TWO_COPY, CUSTOMER_STAGE_THREE_COPY, CUSTOMER_STAGE_SIX_COPY, CUSTOMER_NO_POSSIBILITIES_COPY, createCustomerWorkCard, getLocalGreeting, getPreferredLanguage,
    getServerCustomerPackages, getValidCustomerPossibilities, getValidCustomerWork, initializeCustomerIntention, loadCustomerWork,
    normalizedCustomerIntention, recordCustomerFeedback, recordParticipation, renderCustomerPossibilities, renderCustomerWork,
    requestCustomerLocation, requestCustomerPossibilities,
    saveCustomerPossibility, selectCustomerIntention, toCustomerPossibility, toCustomerWorkItem };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  initializeCustomerIntention(document, navigator, new Date());
  loadCustomerWork(document, fetch);
});
