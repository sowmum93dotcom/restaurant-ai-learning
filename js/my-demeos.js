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
    authElements.status.hidden = false;
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

    if (root.location && root.location.hash === "#privacy-control") { const privacy = triggers.find(trigger => trigger.getAttribute("data-relationship-area") === "privacy-control"); if (privacy) openView(privacy); }
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
      const date = documentObject.createElement("time"); date.dateTime = intention.createdAt; date.textContent = (root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.date(intention.createdAt) : "Saved " + new Date(intention.createdAt).toLocaleDateString()); article.appendChild(date);
      if (removeIntention && intention.intentionId) {
        const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button"; remove.textContent = root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(1) : "Remove";
        remove.addEventListener("click", function () { if (!remove.disabled) removeIntention(intention.intentionId, remove); }); article.appendChild(remove);
      }
      list.appendChild(article);
    });
  }

  async function loadIntentions(documentObject, fetchFunction, successMessage) {
    const loading = documentObject.getElementById("my-intentions-loading");
    const status = documentObject.getElementById("my-intentions-status");
    status.textContent = "";
    let result;
    try {
      const response = await fetchFunction("/api/customer/intentions", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load intentions");
      result = await response.json();
    } catch (_error) {
      loading.hidden = true;
      status.textContent = successMessage ? (root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(3) : "The saved intention was removed, but your intentions could not be refreshed. Please refresh the page.") : (root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(2) : "Your intentions could not be loaded. Please refresh to try again.");
      return;
    }
    if (!result || !Array.isArray(result.intentions)) {
      loading.hidden = true;
      status.textContent = successMessage ? (root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(5) : "The saved intention was removed, but your intentions could not be verified. Please refresh the page.") : (root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(4) : "Your intentions could not be verified. Please refresh the page.");
      return;
    }
    renderIntentions(documentObject, result.intentions, async function (intentionId, button) {
      const status = documentObject.getElementById("my-intentions-status"); button.disabled = true; status.textContent = root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(6) : "Removing saved intention…";
      try {
        const removed = await fetchFunction("/api/customer/intentions", { method: "DELETE", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ intentionId }) });
        if (!removed.ok) throw new Error("Removal failed");
        await loadIntentions(documentObject, fetchFunction, root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(7) : "Saved intention removed.");
      } catch (_error) { button.disabled = false; status.textContent = root.DEMEOSMyIntentionsLanguage ? root.DEMEOSMyIntentionsLanguage.text(8) : "The saved intention could not be removed."; }
    });
    if (successMessage) status.textContent = successMessage;
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
      const provider = documentObject.createElement("p"); provider.textContent = (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(0) : "Provided by ") + possibility.businessName; article.appendChild(provider);
      if (possibility.location) { const location = documentObject.createElement("p"); location.textContent = possibility.location; article.appendChild(location); }
      if (Array.isArray(possibility.products) && possibility.products.length) {
        const productsHeading = documentObject.createElement("h5"); productsHeading.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(1) : "Products shown with this possibility"; article.appendChild(productsHeading);
        const products = documentObject.createElement("div"); products.className = "my-demeos-saved-products";
        possibility.products.forEach(function (product) {
          const productCard = documentObject.createElement("div"); productCard.className = "my-demeos-saved-product";
          if (product.imageUrl) {
            const image = documentObject.createElement("img"); image.src = product.imageUrl; image.alt = product.name || ""; image.loading = "lazy";
            productCard.appendChild(image);
          }
          const name = documentObject.createElement("strong"); name.textContent = product.name; productCard.appendChild(name);
          if (product.description) { const description = documentObject.createElement("p"); description.textContent = product.description; productCard.appendChild(description); }
          const historicalPrice = product.priceMode === "contact" ? (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(2) : "Contact for price") :
            product.priceMode === "from" && product.price ? (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(3) : "From ") + product.price :
            product.priceMode === "range" && product.price ? (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(4) : "Price range: ") + product.price : product.price;
          if (historicalPrice) { const price = documentObject.createElement("p"); price.textContent = historicalPrice; productCard.appendChild(price); }
          if (product.fulfilment && Array.isArray(product.fulfilment.methods) && product.fulfilment.methods.length) {
            const v = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.values() : null; const labels = { collection: v ? v[5] : "Collection", delivery: v ? v[6] : "Delivery", shipping: v ? v[7] : "Shipping", premises: v ? v[8] : "At the business", "customer-location": v ? v[9] : "At your location", appointment: v ? v[10] : "Appointment", digital: v ? v[11] : "Digital" };
            const fulfilment = documentObject.createElement("p"); fulfilment.textContent = (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(12) : "Shown fulfilment: ") + product.fulfilment.methods.map(function (method) { return labels[method] || method; }).join(" · ");
            productCard.appendChild(fulfilment);
          }
          const availability = documentObject.createElement("p");
          availability.textContent = product.availability ? (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(13) : "Shown availability: ") + product.availability : (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(14) : "Availability was not stated.");
          productCard.appendChild(availability); products.appendChild(productCard);
        });
        article.appendChild(products);
        const historical = documentObject.createElement("p"); historical.className = "my-demeos-meaning";
        historical.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(15) : "This is the product information DEMEOS showed at the time. Availability may have changed; check with the business before continuing.";
        article.appendChild(historical);
      }
      if (possibility.relevance && possibility.relevance.basis === "explicit-customer-intent-overlap") {
        const why = documentObject.createElement("p"); why.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(16) : "Why this appeared: explicit customer intent overlap"; article.appendChild(why);
      }
      const recordedAt = possibility.issuedAt || possibility.createdAt;
      const date = documentObject.createElement("time"); date.dateTime = recordedAt;
      date.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.date(recordedAt) : "Shown " + new Date(recordedAt).toLocaleDateString(); article.appendChild(date);
      if (possibility.feedback) {
        const feedback = documentObject.createElement("p");
        feedback.textContent = (root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(18) : "Your feedback: ") + possibility.feedback.response;
        article.appendChild(feedback);
        if (possibility.feedback.comment) { const comment = documentObject.createElement("p"); comment.textContent = possibility.feedback.comment; article.appendChild(comment); }
      }
      if (removePossibility && possibility.savedPossibilityId) {
        const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button"; remove.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(19) : "Remove";
        remove.addEventListener("click", function () { if (!remove.disabled) removePossibility(possibility.savedPossibilityId, remove); }); article.appendChild(remove);
      }
      list.appendChild(article);
    });
  }

  async function loadPossibilities(documentObject, fetchFunction, successMessage) {
    const loading = documentObject.getElementById("my-possibilities-loading");
    const status = documentObject.getElementById("my-possibilities-status");
    status.textContent = "";
    let result;
    try {
      const response = await fetchFunction("/api/customer/possibilities/saved", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load possibilities");
      result = await response.json();
    } catch (_error) {
      loading.hidden = true;
      status.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(successMessage ? 21 : 20) : (successMessage ? "The saved possibility was removed, but your possibilities could not be refreshed. Please refresh the page." : "Your possibilities could not be loaded. Please refresh to try again.");
      return;
    }
    if (!result || !Array.isArray(result.possibilities)) {
      loading.hidden = true;
      status.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(successMessage ? 23 : 22) : (successMessage ? "The saved possibility was removed, but your possibilities could not be verified. Please refresh the page." : "Your possibilities could not be verified. Please refresh the page.");
      return;
    }
    renderPossibilities(documentObject, result.possibilities, async function (savedPossibilityId, button) {
      const status = documentObject.getElementById("my-possibilities-status"); button.disabled = true; status.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(24) : "Removing saved possibility…";
      try {
        const removed = await fetchFunction("/api/customer/possibilities/saved", { method: "DELETE", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ savedPossibilityId }) });
        if (!removed.ok) throw new Error("Removal failed");
        await loadPossibilities(documentObject, fetchFunction, root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(25) : "Saved possibility removed.");
      } catch (_error) { button.disabled = false; status.textContent = root.DEMEOSMyPossibilitiesLanguage ? root.DEMEOSMyPossibilitiesLanguage.text(26) : "The saved possibility could not be removed."; }
    });
    if (successMessage) status.textContent = successMessage;
  }

  function renderParticipations(documentObject, participations) {
    const list = documentObject.getElementById("my-participation-list");
    const empty = documentObject.getElementById("my-participation-empty");
    documentObject.getElementById("my-participation-loading").hidden = true;
    list.textContent = "";
    empty.hidden = participations.length !== 0;
    participations.forEach(function (participation) {
      const article = documentObject.createElement("article");
      const action = documentObject.createElement("h4"); action.textContent = root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.text(0) : "Interested"; article.appendChild(action);
      if (participation.content) { const content = documentObject.createElement("p"); content.textContent = participation.content; article.appendChild(content); }
      if (participation.businessName) { const provider = documentObject.createElement("p"); provider.textContent = (root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.text(1) : "Provided by ") + participation.businessName; article.appendChild(provider); }
      if (participation.location) { const location = documentObject.createElement("p"); location.textContent = participation.location; article.appendChild(location); }
      const date = documentObject.createElement("time"); date.dateTime = participation.participatedAt;
      date.textContent = root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.date(participation.participatedAt) : new Date(participation.participatedAt).toLocaleDateString(); article.appendChild(date);
      list.appendChild(article);
    });
  }

  async function loadParticipations(documentObject, fetchFunction) {
    const loading = documentObject.getElementById("my-participation-loading");
    loading.textContent = root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.text(2) : "Loading your participation…";
    loading.hidden = false;
    let result;
    try {
      const response = await fetchFunction("/api/customer/participation", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load participation");
      result = await response.json();
    } catch (_error) {
      loading.textContent = root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.text(3) : "Your participation could not be loaded. Please refresh to try again.";
      return;
    }
    if (!result || !Array.isArray(result.participations)) {
      loading.textContent = root.DEMEOSMyParticipationLanguage ? root.DEMEOSMyParticipationLanguage.text(4) : "Your participation could not be verified. Please refresh the page.";
      return;
    }
    renderParticipations(documentObject, result.participations);
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
        date.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.date(preference.createdAt) : "Saved " + new Date(preference.createdAt).toLocaleDateString(); article.appendChild(date);
      }
      const remove = documentObject.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button";
      remove.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(1) : "Remove";
      remove.addEventListener("click", function () { if (!remove.disabled) removePreference(preference.preferenceId, remove); });
      article.appendChild(remove); list.appendChild(article);
    });
  }

  async function loadPreferences(documentObject, fetchFunction, successMessage) {
    const loading = documentObject.getElementById("my-preferences-loading");
    const status = documentObject.getElementById("my-preferences-status");
    status.textContent = "";
    loading.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(2) : "Loading your preferences…";
    loading.hidden = false;
    let result;
    try {
      const response = await fetchFunction("/api/customer/preferences", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load preferences");
      result = await response.json();
    } catch (_error) {
      loading.hidden = true;
      status.textContent = successMessage ? (root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(3) : "Your change was saved, but your preferences could not be refreshed. Please refresh the page.") : (root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(4) : "Your preferences could not be loaded. Please refresh to try again.");
      return false;
    }
    if (!result || !Array.isArray(result.preferences)) {
      loading.hidden = true;
      status.textContent = successMessage ? (root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(5) : "Your change was saved, but your preferences could not be verified. Please refresh the page.") : (root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(6) : "Your preferences could not be verified. Please refresh the page.");
      return false;
    }
    renderPreferences(documentObject, result.preferences, async function (preferenceId, button) {
      button.disabled = true;
      status.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(7) : "Removing preference…";
      try {
        const removed = await fetchFunction("/api/customer/preferences", { method: "DELETE", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ preferenceId }) });
        if (!removed.ok) throw new Error("Removal failed");
        await loadPreferences(documentObject, fetchFunction, root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(8) : "Preference removed.");
      } catch (_error) {
        button.disabled = false;
        status.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(9) : "Your preference could not be removed. Please try again.";
      }
    });
    if (successMessage) status.textContent = successMessage;
    return true;
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
      status.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(10) : "Saving your preference…";
      if (submit) submit.disabled = true;
      let response;
      try {
        response = await fetchFunction("/api/customer/preferences", { method: "POST", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ preference }) });
      } catch (_error) {
        status.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(11) : "Your preference could not be saved. Please try again.";
        if (submit) submit.disabled = false;
        return;
      }
      if (!response.ok) { status.textContent = root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(12) : "Your preference could not be saved."; if (submit) submit.disabled = false; return; }
      input.value = "";
      await loadPreferences(documentObject, fetchFunction, root.DEMEOSMyPreferencesLanguage ? root.DEMEOSMyPreferencesLanguage.text(13) : "Preference saved.");
      if (submit) submit.disabled = false;
    });
  }

  async function loadPrivacyControls(documentObject, fetchFunction, successMessage) {
    const form = documentObject.getElementById("privacy-controls-form");
    const submit = form.querySelector('button[type="submit"]');
    const status = documentObject.getElementById("privacy-controls-status");
    if (submit) submit.disabled = true;
    status.textContent = root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(0) : "Loading your privacy controls…";
    let result;
    try {
      const response = await fetchFunction("/api/customer/privacy-controls", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load privacy controls");
      result = await response.json();
    } catch (_error) {
      status.textContent = successMessage ? (root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(1) : "Your privacy controls were saved, but could not be refreshed. Please refresh the page before making further changes.") : (root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(2) : "Your privacy controls could not be loaded. Please refresh to try again.");
      return;
    }
    const controls = result && result.controls;
    if (!controls || typeof controls.usePreferencesAsGuidance !== "boolean" || typeof controls.useFeedbackAsGuidance !== "boolean") {
      status.textContent = root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(3) : "Your privacy controls could not be verified. Please refresh before making changes.";
      return;
    }
    documentObject.getElementById("use-preferences-as-guidance").checked = controls.usePreferencesAsGuidance === true;
    documentObject.getElementById("use-feedback-as-guidance").checked = controls.useFeedbackAsGuidance === true;
    form.dataset.loadedPreferencesGuidance = String(controls.usePreferencesAsGuidance === true);
    form.dataset.loadedFeedbackGuidance = String(controls.useFeedbackAsGuidance === true);
    status.textContent = successMessage || "";
    if (submit) submit.disabled = false;
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
      status.textContent = root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(4) : "Saving your privacy controls…";
      if (submit) submit.disabled = true;
      let response;
      try {
        response = await fetchFunction("/api/customer/privacy-controls", { method: "POST", credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(controls) });
      } catch (_error) {
        status.textContent = root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(5) : "Your privacy controls could not be saved. Please try again.";
        if (submit) submit.disabled = false;
        return;
      }
      if (response.ok) await loadPrivacyControls(documentObject, fetchFunction, root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(6) : "Privacy controls saved.");
      else status.textContent = root.DEMEOSPrivacyControlLanguage ? root.DEMEOSPrivacyControlLanguage.text(7) : "Your privacy controls could not be saved.";
      if (!response.ok && submit) submit.disabled = false;
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
      const localization = windowObject.DEMEOSCustomerAuthLanguage ? await windowObject.DEMEOSCustomerAuthLanguage.localization() : undefined;
      await clerk.load({ ui: { ClerkUI: windowObject.__internal_ClerkUICtor }, ...(localization ? { localization } : {}) });
      if (windowObject.DEMEOSCustomerAuthLanguage) windowObject.DEMEOSCustomerAuthLanguage.bind(clerk);

      async function update() {
        const hasProviderSession = Boolean(clerk.user);
        const authenticated = hasProviderSession ? await confirmTrustedCustomer(fetchFunction) : false;
        showState(authElements, hasProviderSession ? "signedIn" : "signedOut");
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
        if (authenticated && windowObject.DEMEOSCustomerPurchasePreparation && windowObject.DEMEOSCustomerPurchasePreparation.authenticationReturn()) return;
        if (authenticated) await Promise.allSettled([loadIntentions(documentObject, fetchFunction), loadPossibilities(documentObject, fetchFunction), loadParticipations(documentObject, fetchFunction), loadPreferences(documentObject, fetchFunction), loadPrivacyControls(documentObject, fetchFunction)]);
      }
      authElements.signIn.addEventListener("click", function () { const preparation = windowObject.DEMEOSCustomerPurchasePreparation; const returnPath = preparation && preparation.authenticationPath(); clerk.openSignIn({ withSignUp: true, ...(returnPath ? { forceRedirectUrl: returnPath, signUpForceRedirectUrl: returnPath } : {}) }); });
      const createAccount = documentObject.getElementById('customer-create-account');
      if (createAccount) createAccount.addEventListener('click', function () {
        const preparation = windowObject.DEMEOSCustomerPurchasePreparation;
        const returnPath = preparation && preparation.authenticationPath() || windowObject.location.href;
        clerk.openSignUp({ forceRedirectUrl: returnPath, signInForceRedirectUrl: returnPath });
      });
      authElements.signOut.addEventListener("click", function () { clerk.signOut(); });
      clerk.addListener(update);
      await update();
    } catch (_error) {
      showState(authElements, "unavailable");
    }
  }

  function setupLiveLanguageRefresh(documentObject, fetchFunction) {
    if (!documentObject || !fetchFunction) return;
    documentObject.addEventListener("change", function (event) {
      if (!event.target || event.target.id !== "customer-language") return;
      const signedIn = documentObject.getElementById("customer-auth-signed-in");
      if (!signedIn || signedIn.hidden) return;
      const preferenceInput = documentObject.getElementById("customer-preference");
      const preferenceDirty = Boolean(preferenceInput && preferenceInput.value && preferenceInput.value.trim());
      const privacyForm = documentObject.getElementById("privacy-controls-form");
      const preferencesGuidance = documentObject.getElementById("use-preferences-as-guidance");
      const feedbackGuidance = documentObject.getElementById("use-feedback-as-guidance");
      const privacyDirty = Boolean(privacyForm && preferencesGuidance && feedbackGuidance &&
        privacyForm.dataset && privacyForm.dataset.loadedPreferencesGuidance !== undefined &&
        (String(preferencesGuidance.checked) !== privacyForm.dataset.loadedPreferencesGuidance ||
         String(feedbackGuidance.checked) !== privacyForm.dataset.loadedFeedbackGuidance));
      const refreshes = [
        loadIntentions(documentObject, fetchFunction),
        loadPossibilities(documentObject, fetchFunction),
        loadParticipations(documentObject, fetchFunction)
      ];
      if (!preferenceDirty) refreshes.push(loadPreferences(documentObject, fetchFunction));
      if (!privacyDirty) refreshes.push(loadPrivacyControls(documentObject, fetchFunction));
      return Promise.allSettled(refreshes);
    });
  }

  const api = { confirmTrustedCustomer, showState, setupRelationshipDashboard, renderIntentions, loadIntentions, renderPossibilities, loadPossibilities, renderParticipations, loadParticipations, renderPreferences, loadPreferences, setupPreferenceCreation, loadPrivacyControls, setupPrivacyControls, setupLiveLanguageRefresh, initialiseCustomerAuthentication };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.fetch) {
    setupRelationshipDashboard(root.document);
    setupPreferenceCreation(root.document, root.fetch.bind(root));
    setupLiveLanguageRefresh(root.document, root.fetch.bind(root));
    setupPrivacyControls(root.document, root.fetch.bind(root));
    initialiseCustomerAuthentication(root, root.document, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : globalThis);
