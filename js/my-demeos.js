(function (root) {
  "use strict";

  function elements(documentObject) {
    return {
      status: documentObject.getElementById("customer-auth-status"),
      loading: documentObject.getElementById("customer-auth-loading"),
      signedOut: documentObject.getElementById("customer-auth-signed-out"),
      signedIn: documentObject.getElementById("customer-auth-signed-in"),
      unavailable: documentObject.getElementById("customer-auth-unavailable"),
      signIn: documentObject.getElementById("customer-sign-in"),
      signOut: documentObject.getElementById("customer-sign-out")
    };
  }

  function showState(authElements, state) {
    authElements.status.hidden = state === "signedIn";
    for (const name of ["loading", "signedOut", "signedIn", "unavailable"]) {
      authElements[name].hidden = name !== state;
    }
  }

  function setupRelationshipDashboard(documentObject) {
    const overview = documentObject.getElementById("my-demeos-overview");
    const triggers = Array.from(documentObject.querySelectorAll("[data-relationship-area]"));
    const views = Array.from(documentObject.querySelectorAll(".my-demeos-relationship-view"));
    let activeTrigger = null;

    function openView(trigger) {
      const view = documentObject.getElementById(trigger.getAttribute("data-relationship-area"));
      if (!view) return;
      activeTrigger = trigger;
      overview.hidden = true;
      views.forEach(function (candidate) { candidate.hidden = candidate !== view; });
      const heading = view.querySelector("h2");
      if (heading) heading.focus();
    }

    function closeView() {
      views.forEach(function (view) { view.hidden = true; });
      overview.hidden = false;
      if (activeTrigger) activeTrigger.focus();
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () { openView(trigger); });
    });
    documentObject.querySelectorAll("[data-relationship-back]").forEach(function (button) {
      button.addEventListener("click", closeView);
    });
    documentObject.querySelectorAll(".relationship-sign-in").forEach(function (button) {
      button.addEventListener("click", function () {
        const existingAction = documentObject.getElementById("customer-sign-in");
        if (existingAction) existingAction.click();
      });
    });

    return { openView, closeView };
  }

  function renderIntentions(documentObject, intentions, removeIntention) {
    const list = documentObject.getElementById("my-intentions-list");
    const empty = documentObject.getElementById("my-intentions-empty");
    documentObject.getElementById("my-intentions-loading").hidden = true;
    list.textContent = "";
    empty.hidden = intentions.length !== 0;
    intentions.forEach(function (intention) {
      const article = documentObject.createElement("article");
      const heading = documentObject.createElement("h4"); heading.textContent = intention.intention; article.appendChild(heading);
      if (intention.customerText) { const detail = documentObject.createElement("p"); detail.textContent = intention.customerText; article.appendChild(detail); }
      const understanding = documentObject.createElement("p"); understanding.textContent = intention.understanding; article.appendChild(understanding);
      const date = documentObject.createElement("time"); date.dateTime = intention.createdAt; date.textContent = "Saved " + new Date(intention.createdAt).toLocaleDateString(); article.appendChild(date);
      if (removeIntention && intention.intentionId) {
        const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button"; remove.textContent = "Remove";
        remove.addEventListener("click", function () { removeIntention(intention.intentionId, remove); }); article.appendChild(remove);
      }
      list.appendChild(article);
    });
  }

  async function loadIntentions(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/intentions", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load intentions");
    const result = await response.json();
    renderIntentions(documentObject, Array.isArray(result.intentions) ? result.intentions : [], async function (intentionId, button) {
      const status = documentObject.getElementById("my-intentions-status"); button.disabled = true; status.textContent = "Removing saved intention…";
      try {
        const removed = await fetchFunction("/api/customer/intentions", { method: "DELETE", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ intentionId }) });
        if (!removed.ok) throw new Error("Removal failed");
        status.textContent = "Saved intention removed."; await loadIntentions(documentObject, fetchFunction);
      } catch (_error) { button.disabled = false; status.textContent = "The saved intention could not be removed."; }
    });
  }

  function renderPossibilities(documentObject, possibilities, removePossibility) {
    const list = documentObject.getElementById("my-possibilities-list");
    const empty = documentObject.getElementById("my-possibilities-empty");
    documentObject.getElementById("my-possibilities-loading").hidden = true;
    list.textContent = "";
    empty.hidden = possibilities.length !== 0;
    possibilities.forEach(function (possibility) {
      const article = documentObject.createElement("article");
      const content = documentObject.createElement("h4"); content.textContent = possibility.content; article.appendChild(content);
      const provider = documentObject.createElement("p"); provider.textContent = "Provided by " + possibility.businessName; article.appendChild(provider);
      if (possibility.location) { const location = documentObject.createElement("p"); location.textContent = possibility.location; article.appendChild(location); }
      if (Array.isArray(possibility.products) && possibility.products.length) {
        const productsHeading = documentObject.createElement("h5"); productsHeading.textContent = "Products shown with this possibility"; article.appendChild(productsHeading);
        const products = documentObject.createElement("div"); products.className = "my-demeos-saved-products";
        possibility.products.forEach(function (product) {
          const productCard = documentObject.createElement("div"); productCard.className = "my-demeos-saved-product";
          if (product.imageUrl) {
            const image = documentObject.createElement("img"); image.src = product.imageUrl; image.alt = product.name || ""; image.loading = "lazy";
            productCard.appendChild(image);
          }
          const name = documentObject.createElement("strong"); name.textContent = product.name; productCard.appendChild(name);
          if (product.description) { const description = documentObject.createElement("p"); description.textContent = product.description; productCard.appendChild(description); }
          const historicalPrice = product.priceMode === "contact" ? "Contact for price" :
            product.priceMode === "from" && product.price ? "From " + product.price :
            product.priceMode === "range" && product.price ? "Price range: " + product.price : product.price;
          if (historicalPrice) { const price = documentObject.createElement("p"); price.textContent = historicalPrice; productCard.appendChild(price); }
          if (product.fulfilment && Array.isArray(product.fulfilment.methods) && product.fulfilment.methods.length) {
            const labels = { collection: "Collection", delivery: "Delivery", shipping: "Shipping", premises: "At the business", "customer-location": "At your location", appointment: "Appointment", digital: "Digital" };
            const fulfilment = documentObject.createElement("p"); fulfilment.textContent = "Shown fulfilment: " + product.fulfilment.methods.map(function (method) { return labels[method] || method; }).join(" · ");
            productCard.appendChild(fulfilment);
          }
          const availability = documentObject.createElement("p");
          availability.textContent = product.availability ? "Shown availability: " + product.availability : "Availability was not stated.";
          productCard.appendChild(availability); products.appendChild(productCard);
        });
        article.appendChild(products);
        const historical = documentObject.createElement("p"); historical.className = "my-demeos-meaning";
        historical.textContent = "This is the product information DEMEOS showed at the time. Availability may have changed; check with the business before continuing.";
        article.appendChild(historical);
      }
      if (possibility.relevance && possibility.relevance.basis === "explicit-customer-intent-overlap") {
        const why = documentObject.createElement("p"); why.textContent = "Why this appeared: explicit customer intent overlap"; article.appendChild(why);
      }
      const recordedAt = possibility.issuedAt || possibility.createdAt;
      const date = documentObject.createElement("time"); date.dateTime = recordedAt;
      date.textContent = "Shown " + new Date(recordedAt).toLocaleDateString(); article.appendChild(date);
      if (possibility.feedback) {
        const feedback = documentObject.createElement("p");
        feedback.textContent = "Your feedback: " + possibility.feedback.response;
        article.appendChild(feedback);
        if (possibility.feedback.comment) { const comment = documentObject.createElement("p"); comment.textContent = possibility.feedback.comment; article.appendChild(comment); }
      }
      if (removePossibility && possibility.savedPossibilityId) {
        const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button"; remove.textContent = "Remove";
        remove.addEventListener("click", function () { removePossibility(possibility.savedPossibilityId, remove); }); article.appendChild(remove);
      }
      list.appendChild(article);
    });
  }

  async function loadPossibilities(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/possibilities/saved", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load possibilities");
    const result = await response.json();
    renderPossibilities(documentObject, Array.isArray(result.possibilities) ? result.possibilities : [], async function (savedPossibilityId, button) {
      const status = documentObject.getElementById("my-possibilities-status"); button.disabled = true; status.textContent = "Removing saved possibility…";
      try {
        const removed = await fetchFunction("/api/customer/possibilities/saved", { method: "DELETE", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ savedPossibilityId }) });
        if (!removed.ok) throw new Error("Removal failed");
        status.textContent = "Saved possibility removed."; await loadPossibilities(documentObject, fetchFunction);
      } catch (_error) { button.disabled = false; status.textContent = "The saved possibility could not be removed."; }
    });
  }

  function renderParticipations(documentObject, participations) {
    const list = documentObject.getElementById("my-participation-list");
    const empty = documentObject.getElementById("my-participation-empty");
    documentObject.getElementById("my-participation-loading").hidden = true;
    list.textContent = "";
    empty.hidden = participations.length !== 0;
    participations.forEach(function (participation) {
      const article = documentObject.createElement("article");
      const action = documentObject.createElement("h4"); action.textContent = "Interested"; article.appendChild(action);
      if (participation.content) { const content = documentObject.createElement("p"); content.textContent = participation.content; article.appendChild(content); }
      if (participation.businessName) { const provider = documentObject.createElement("p"); provider.textContent = "Provided by " + participation.businessName; article.appendChild(provider); }
      if (participation.location) { const location = documentObject.createElement("p"); location.textContent = participation.location; article.appendChild(location); }
      const date = documentObject.createElement("time"); date.dateTime = participation.participatedAt;
      date.textContent = new Date(participation.participatedAt).toLocaleDateString(); article.appendChild(date);
      list.appendChild(article);
    });
  }

  async function loadParticipations(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/participation", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load participation");
    const result = await response.json();
    renderParticipations(documentObject, Array.isArray(result.participations) ? result.participations : []);
  }

  function renderPreferences(documentObject, preferences, removePreference) {
    const list = documentObject.getElementById("my-preferences-list");
    const empty = documentObject.getElementById("my-preferences-empty");
    documentObject.getElementById("my-preferences-loading").hidden = true;
    list.textContent = "";
    empty.hidden = preferences.length !== 0;
    preferences.forEach(function (preference) {
      const article = documentObject.createElement("article");
      const text = documentObject.createElement("h4"); text.textContent = preference.preference; article.appendChild(text);
      if (preference.createdAt) {
        const date = documentObject.createElement("time"); date.dateTime = preference.createdAt;
        date.textContent = "Saved " + new Date(preference.createdAt).toLocaleDateString(); article.appendChild(date);
      }
      const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () { removePreference(preference.preferenceId); });
      article.appendChild(remove); list.appendChild(article);
    });
  }

  async function loadPreferences(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/preferences", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load preferences");
    const result = await response.json();
    renderPreferences(documentObject, Array.isArray(result.preferences) ? result.preferences : [], async function (preferenceId) {
      const removed = await fetchFunction("/api/customer/preferences", { method: "DELETE", credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ preferenceId }) });
      if (removed.ok) await loadPreferences(documentObject, fetchFunction);
    });
  }

  function setupPreferenceCreation(documentObject, fetchFunction) {
    const form = documentObject.getElementById("my-preferences-form");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      if (submit && submit.disabled) return;
      const input = documentObject.getElementById("customer-preference");
      const status = documentObject.getElementById("my-preferences-status");
      const preference = input.value.trim();
      if (!preference) return;
      status.textContent = "Saving your preference…";
      if (submit) submit.disabled = true;
      const response = await fetchFunction("/api/customer/preferences", { method: "POST", credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ preference }) });
      if (!response.ok) { status.textContent = "Your preference could not be saved."; if (submit) submit.disabled = false; return; }
      input.value = ""; status.textContent = "Preference saved.";
      await loadPreferences(documentObject, fetchFunction);
      if (submit) submit.disabled = false;
    });
  }

  async function loadPrivacyControls(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/privacy-controls", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load privacy controls");
    const result = await response.json();
    const controls = result.controls || {};
    documentObject.getElementById("use-preferences-as-guidance").checked = controls.usePreferencesAsGuidance === true;
    documentObject.getElementById("use-feedback-as-guidance").checked = controls.useFeedbackAsGuidance === true;
  }

  function setupPrivacyControls(documentObject, fetchFunction) {
    const form = documentObject.getElementById("privacy-controls-form");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      if (submit && submit.disabled) return;
      const status = documentObject.getElementById("privacy-controls-status");
      const controls = { usePreferencesAsGuidance: documentObject.getElementById("use-preferences-as-guidance").checked,
        useFeedbackAsGuidance: documentObject.getElementById("use-feedback-as-guidance").checked };
      status.textContent = "Saving your privacy controls…";
      if (submit) submit.disabled = true;
      const response = await fetchFunction("/api/customer/privacy-controls", { method: "POST", credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(controls) });
      status.textContent = response.ok ? "Privacy controls saved." : "Your privacy controls could not be saved.";
      if (response.ok) await loadPrivacyControls(documentObject, fetchFunction);
      if (submit) submit.disabled = false;
    });
  }

  async function confirmTrustedCustomer(fetchFunction) {
    const response = await fetchFunction("/api/customer/identity", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result && result.authenticated === true;
  }

  function frontendApiDomain(publishableKey) {
    const encoded = publishableKey.split("_").pop();
    try { return root.atob(encoded).replace(/\$$/, ""); } catch (_error) { return null; }
  }

  function appendScript(documentObject, source, publishableKey) {
    return new Promise(function (resolve, reject) {
      const script = documentObject.createElement("script");
      script.src = source;
      script.crossOrigin = "anonymous";
      if (publishableKey) script.dataset.clerkPublishableKey = publishableKey;
      script.onload = resolve;
      script.onerror = reject;
      documentObject.head.appendChild(script);
    });
  }

  async function initialiseCustomerAuthentication(windowObject, documentObject, fetchFunction) {
    const authElements = elements(documentObject);
    try {
      const configResponse = await fetchFunction("/api/public-config", { credentials: "same-origin" });
      if (!configResponse.ok) throw new Error("Provider configuration unavailable");
      const config = await configResponse.json();
      const domain = frontendApiDomain(config.clerkPublishableKey);
      if (!domain) throw new Error("Invalid provider configuration");

      await appendScript(documentObject, `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await appendScript(documentObject, `https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, config.clerkPublishableKey);
      const clerk = windowObject.Clerk;
      if (!clerk || typeof clerk.load !== "function" || !windowObject.__internal_ClerkUICtor) {
        throw new Error("Provider unavailable");
      }
      await clerk.load({ ui: { ClerkUI: windowObject.__internal_ClerkUICtor } });

      async function update() {
        const authenticated = clerk.user ? await confirmTrustedCustomer(fetchFunction) : false;
        showState(authElements, authenticated ? "signedIn" : "signedOut");
        documentObject.getElementById("my-intentions-signed-out").hidden = authenticated;
        documentObject.getElementById("my-intentions-signed-in").hidden = !authenticated;
        documentObject.getElementById("my-possibilities-signed-out").hidden = authenticated;
        documentObject.getElementById("my-possibilities-signed-in").hidden = !authenticated;
        documentObject.getElementById("my-participation-signed-out").hidden = authenticated;
        documentObject.getElementById("my-participation-signed-in").hidden = !authenticated;
        documentObject.getElementById("my-preferences-signed-out").hidden = authenticated;
        documentObject.getElementById("my-preferences-signed-in").hidden = !authenticated;
        documentObject.getElementById("privacy-control-signed-out").hidden = authenticated;
        documentObject.getElementById("privacy-controls-form").hidden = !authenticated;
        if (authenticated) await Promise.all([loadIntentions(documentObject, fetchFunction), loadPossibilities(documentObject, fetchFunction), loadParticipations(documentObject, fetchFunction), loadPreferences(documentObject, fetchFunction), loadPrivacyControls(documentObject, fetchFunction)]);
      }
      authElements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
      authElements.signOut.addEventListener("click", function () { clerk.signOut(); });
      clerk.addListener(update);
      await update();
    } catch (_error) {
      showState(authElements, "unavailable");
    }
  }

  const api = { confirmTrustedCustomer, showState, setupRelationshipDashboard, renderIntentions, loadIntentions, renderPossibilities, loadPossibilities, renderParticipations, loadParticipations, renderPreferences, loadPreferences, setupPreferenceCreation, loadPrivacyControls, setupPrivacyControls, initialiseCustomerAuthentication };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.fetch) {
    setupRelationshipDashboard(root.document);
    setupPreferenceCreation(root.document, root.fetch.bind(root));
    setupPrivacyControls(root.document, root.fetch.bind(root));
    initialiseCustomerAuthentication(root, root.document, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : globalThis);
