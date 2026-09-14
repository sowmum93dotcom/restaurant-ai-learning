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
      }
      authElements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
      authElements.signOut.addEventListener("click", function () { clerk.signOut(); });
      clerk.addListener(update);
      await update();
    } catch (_error) {
      showState(authElements, "unavailable");
    }
  }

  const api = { confirmTrustedCustomer, showState, initialiseCustomerAuthentication };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.fetch) {
    initialiseCustomerAuthentication(root, root.document, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : globalThis);
