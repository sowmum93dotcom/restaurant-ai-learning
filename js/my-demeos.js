(function (root) {
  "use strict";

  function elements(documentObject) {
    return {
      loading: documentObject.getElementById("customer-auth-loading"),
      signedOut: documentObject.getElementById("customer-auth-signed-out"),
      signedIn: documentObject.getElementById("customer-auth-signed-in"),
      unavailable: documentObject.getElementById("customer-auth-unavailable"),
      signIn: documentObject.getElementById("customer-sign-in"),
      signOut: documentObject.getElementById("customer-sign-out")
    };
  }

  function showState(authElements, state) {
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

  function renderIntentions(documentObject, intentions) {
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
      list.appendChild(article);
    });
  }

  async function loadIntentions(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/intentions", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load intentions");
    const result = await response.json();
    renderIntentions(documentObject, Array.isArray(result.intentions) ? result.intentions : []);
  }

  function renderPossibilities(documentObject, possibilities) {
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
      if (possibility.relevance && possibility.relevance.basis === "explicit-customer-intent-overlap") {
        const why = documentObject.createElement("p"); why.textContent = "Why this appeared: explicit customer intent overlap"; article.appendChild(why);
      }
      const date = documentObject.createElement("time"); date.dateTime = possibility.createdAt;
      date.textContent = "Saved " + new Date(possibility.createdAt).toLocaleDateString(); article.appendChild(date);
      list.appendChild(article);
    });
  }

  async function loadPossibilities(documentObject, fetchFunction) {
    const response = await fetchFunction("/api/customer/possibilities/saved", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load possibilities");
    const result = await response.json();
    renderPossibilities(documentObject, Array.isArray(result.possibilities) ? result.possibilities : []);
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
        if (authenticated) await Promise.all([loadIntentions(documentObject, fetchFunction), loadPossibilities(documentObject, fetchFunction), loadParticipations(documentObject, fetchFunction)]);
      }
      authElements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
      authElements.signOut.addEventListener("click", function () { clerk.signOut(); });
      clerk.addListener(update);
      await update();
    } catch (_error) {
      showState(authElements, "unavailable");
    }
  }

  const api = { confirmTrustedCustomer, showState, setupRelationshipDashboard, renderIntentions, loadIntentions, renderPossibilities, loadPossibilities, renderParticipations, loadParticipations, initialiseCustomerAuthentication };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.fetch) {
    setupRelationshipDashboard(root.document);
    initialiseCustomerAuthentication(root, root.document, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : globalThis);
