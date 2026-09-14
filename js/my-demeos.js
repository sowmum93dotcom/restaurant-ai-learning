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
        if (authenticated) await loadIntentions(documentObject, fetchFunction);
      }
      authElements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
      authElements.signOut.addEventListener("click", function () { clerk.signOut(); });
      clerk.addListener(update);
      await update();
    } catch (_error) {
      showState(authElements, "unavailable");
    }
  }

  const api = { confirmTrustedCustomer, showState, renderIntentions, loadIntentions, initialiseCustomerAuthentication };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.fetch) {
    initialiseCustomerAuthentication(root, root.document, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : globalThis);
