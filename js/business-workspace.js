function parseWorkspaceValue(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function createWorkspaceBusinessId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOwnerNavigationSection(locationObject, workspaceView) {
  const pathname = locationObject && typeof locationObject.pathname === "string"
    ? locationObject.pathname : "";
  const page = pathname.split("/").pop() || "index.html";
  if (page === "business-workspace.html") return "overview";
  if (page === "business-results.html") return "results";

  const view = workspaceView || (locationObject && typeof locationObject.hash === "string"
    ? locationObject.hash.slice(1) : "");
  if (view === "business-profile") return "business-profile";
  if (view === "recommends") return "recommends";
  return "marketing";
}

function updateOwnerNavigation(documentObject, locationObject, workspaceView) {
  const activeSection = getOwnerNavigationSection(locationObject, workspaceView);
  documentObject.querySelectorAll(".owner-workspace-navigation [data-owner-section]").forEach(function (link) {
    const active = link.getAttribute("data-owner-section") === activeSection;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  return activeSection;
}

function syncOwnerWorkspaceFromLocation(documentObject, locationObject) {
  const pathname = locationObject && typeof locationObject.pathname === "string"
    ? locationObject.pathname : "";
  const page = pathname.split("/").pop() || "index.html";
  const hash = locationObject && typeof locationObject.hash === "string" ? locationObject.hash : "";
  if (page !== "index.html" || hash) return false;

  documentObject.querySelectorAll("[data-workspace-panel]").forEach(function (panel) {
    const active = panel.id === "overview";
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  documentObject.querySelectorAll("[data-workspace-view]").forEach(function (button) {
    const active = button.getAttribute("data-workspace-view") === "overview";
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  updateOwnerNavigation(documentObject, locationObject, "overview");
  return true;
}

function migrateWorkspaceBusinessContext(storage) {
  const storedProfiles = parseWorkspaceValue(storage, "demeosBusinessProfiles", []);
  const profiles = Array.isArray(storedProfiles) ? storedProfiles.slice() : [];
  let legacyProfile = parseWorkspaceValue(storage, "demeosBusinessProfile", null);
  let activeBusinessId = storage.getItem("demeosActiveBusinessId");
  let changed = !Array.isArray(storedProfiles);

  if (legacyProfile && typeof legacyProfile === "object" && !Array.isArray(legacyProfile)) {
    if (!legacyProfile.businessId) {
      legacyProfile = { ...legacyProfile, businessId: createWorkspaceBusinessId() };
      if (typeof storage.setItem === "function") storage.setItem("demeosBusinessProfile", JSON.stringify(legacyProfile));
    }
    if (!profiles.some(function (profile) { return profile && profile.businessId === legacyProfile.businessId; })) {
      profiles.push(legacyProfile);
      activeBusinessId = legacyProfile.businessId;
      changed = true;
    }
  }

  if (!profiles.some(function (profile) { return profile && profile.businessId === activeBusinessId; })) {
    activeBusinessId = profiles.length ? profiles[0].businessId : null;
  }

  if (typeof storage.setItem === "function") {
    if (changed || storage.getItem("demeosBusinessProfiles") === null) {
      storage.setItem("demeosBusinessProfiles", JSON.stringify(profiles));
    }
    if (activeBusinessId) storage.setItem("demeosActiveBusinessId", activeBusinessId);
    else if (typeof storage.removeItem === "function") storage.removeItem("demeosActiveBusinessId");
  }

  return { profiles, activeBusinessId };
}

function getOwnerWorkspaceContext(storage) {
  const migrated = migrateWorkspaceBusinessContext(storage);
  const activeBusinessId = migrated.activeBusinessId;
  const profiles = migrated.profiles;
  const campaigns = parseWorkspaceValue(storage, "demeosCampaignHistory", []);
  if (!activeBusinessId || !Array.isArray(profiles)) return { profile: null, currentWork: [] };
  const profile = profiles.find(function (item) { return item && item.businessId === activeBusinessId; }) || null;
  if (!profile) return { profile: null, currentWork: [] };
  const currentWork = (Array.isArray(campaigns) ? campaigns : []).filter(function (campaign) {
    return campaign && campaign.businessId === activeBusinessId;
  }).slice(0, 3).map(function (campaign) {
    return {
      name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) ||
        campaign.campaignTypeLabel || campaign.campaignType || "Marketing work",
      status: campaign.approvalStatus || "Status not recorded"
    };
  });
  return { profile, currentWork };
}

function getOwnerAuthenticationElements(documentObject) {
  return {
    loading: documentObject.getElementById("owner-auth-loading"),
    signedOut: documentObject.getElementById("owner-auth-signed-out"),
    signedIn: documentObject.getElementById("owner-authenticated-workspace"),
    error: documentObject.getElementById("owner-auth-error"),
    account: documentObject.getElementById("owner-account-control"),
    signIn: documentObject.getElementById("owner-sign-in"),
    signOut: documentObject.getElementById("owner-sign-out")
  };
}

function showOwnerAuthenticationState(elements, state) {
  elements.loading.hidden = state !== "loading";
  elements.signedOut.hidden = state !== "signed-out";
  elements.signedIn.hidden = state !== "signed-in";
  elements.error.hidden = state !== "error";
  elements.account.hidden = state !== "signed-in";
}

function renderOwnerWorkspace(documentObject, storage) {
  // Browser business selection is presentation state only. Server-side ownership authorization is authoritative.
  const context = getOwnerWorkspaceContext(storage);
  const identity = documentObject.getElementById("workspace-business-identity");
  const work = documentObject.getElementById("workspace-current-work");
  const headerBusiness = documentObject.getElementById("workspace-header-business");

  // Marketing and Results reuse this authentication boundary without duplicating Overview-only rendering.
  if (!identity || !work) return;

  identity.replaceChildren();
  work.replaceChildren();
  if (!context.profile) {
    identity.textContent = "No saved business is selected.";
    work.textContent = "Save a Business Profile before starting work in DEMEOS.";
    return;
  }
  const name = context.profile.name || "Saved business";
  if (headerBusiness) headerBusiness.textContent = name;
  const heading = documentObject.createElement("strong");
  heading.textContent = name;
  identity.appendChild(heading);
  [context.profile.type, context.profile.location].filter(function (value) {
    return typeof value === "string" && value.trim();
  }).forEach(function (value) {
    const detail = documentObject.createElement("span");
    detail.textContent = value;
    identity.appendChild(detail);
  });
  if (!context.currentWork.length) {
    work.textContent = "No marketing work is stored for this business yet.";
    return;
  }
  context.currentWork.forEach(function (item) {
    const row = documentObject.createElement("article");
    const title = documentObject.createElement("strong");
    const status = documentObject.createElement("span");
    title.textContent = item.name;
    status.textContent = item.status;
    row.append(title, status);
    work.appendChild(row);
  });
}

function bindOwnerClerkSession(clerk, documentObject, storage, elements) {
  let signedIn = Boolean(clerk && clerk.user);
  const update = function (auth) {
    const nextSignedIn = Boolean(auth && auth.user);
    if (nextSignedIn) {
      renderOwnerWorkspace(documentObject, storage);
      showOwnerAuthenticationState(elements, "signed-in");
      if (!signedIn) {
        signedIn = true;
        const windowObject = documentObject && documentObject.defaultView;
        if (windowObject && windowObject.location && typeof windowObject.location.reload === "function") {
          windowObject.location.reload();
          return;
        }
      }
      signedIn = true;
      return;
    }
    signedIn = false;
    showOwnerAuthenticationState(elements, "signed-out");
  };

  elements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
  elements.signOut.addEventListener("click", function () {
    showOwnerAuthenticationState(elements, "signed-out");
    return clerk.signOut();
  });
  clerk.addListener(update);
  update({ user: clerk.user });
}

function getClerkFrontendApiDomain(publishableKey) {
  if (typeof publishableKey !== "string" || typeof atob !== "function") return null;
  const encodedDomain = publishableKey.split("_")[2];
  if (!encodedDomain) return null;
  try {
    const decodedDomain = atob(encodedDomain);
    return decodedDomain.length > 1 ? decodedDomain.slice(0, -1) : null;
  } catch (_error) {
    return null;
  }
}

function appendClerkScript(documentObject, source, publishableKey) {
  return new Promise(function (resolve, reject) {
    const script = documentObject.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    if (publishableKey) script.dataset.clerkPublishableKey = publishableKey;
    script.src = source;
    script.addEventListener("load", resolve);
    script.addEventListener("error", reject);
    documentObject.head.appendChild(script);
  });
}

async function loadClerkBrowserSdk(documentObject, publishableKey) {
  const clerkDomain = getClerkFrontendApiDomain(publishableKey);
  if (!clerkDomain) throw new Error("Invalid Clerk publishable key");

  await appendClerkScript(documentObject, `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await appendClerkScript(documentObject, `https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, publishableKey);
}

async function initialiseOwnerAuthentication(windowObject, documentObject, storage, fetchFunction) {
  const elements = getOwnerAuthenticationElements(documentObject);
  showOwnerAuthenticationState(elements, "loading");
  try {
    const response = await fetchFunction("/api/public-config", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Public authentication configuration unavailable");
    const config = await response.json();
    if (!config || typeof config.clerkPublishableKey !== "string" || !config.clerkPublishableKey.trim()) {
      throw new Error("Invalid public authentication configuration");
    }
    await loadClerkBrowserSdk(documentObject, config.clerkPublishableKey);
    const clerk = windowObject.Clerk;
    if (!clerk || typeof clerk.load !== "function" || !windowObject.__internal_ClerkUICtor) {
      throw new Error("Clerk did not load");
    }
    await clerk.load({ ui: { ClerkUI: windowObject.__internal_ClerkUICtor } });
    bindOwnerClerkSession(clerk, documentObject, storage, elements);
  } catch (error) {
    showOwnerAuthenticationState(elements, "error");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getOwnerWorkspaceContext, migrateWorkspaceBusinessContext, showOwnerAuthenticationState,
    renderOwnerWorkspace, bindOwnerClerkSession, initialiseOwnerAuthentication,
    getOwnerNavigationSection, updateOwnerNavigation, syncOwnerWorkspaceFromLocation
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  updateOwnerNavigation(document, window.location);
  syncOwnerWorkspaceFromLocation(document, window.location);
  window.addEventListener("hashchange", function () {
    syncOwnerWorkspaceFromLocation(document, window.location);
  });
  initialiseOwnerAuthentication(window, document, localStorage, window.fetch.bind(window));
});
