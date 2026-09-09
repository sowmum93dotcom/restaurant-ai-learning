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
  identity.replaceChildren();
  work.replaceChildren();
  if (!context.profile) {
    identity.textContent = "No saved business is selected.";
    work.textContent = "Save a Business Profile before starting work in DEMEOS.";
    return;
  }
  const name = context.profile.name || "Saved business";
  documentObject.getElementById("workspace-header-business").textContent = name;
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
  const update = function (auth) {
    if (auth && auth.user) {
      renderOwnerWorkspace(documentObject, storage);
      showOwnerAuthenticationState(elements, "signed-in");
      return;
    }
    showOwnerAuthenticationState(elements, "signed-out");
  };

  elements.signIn.addEventListener("click", function () { clerk.openSignIn(); });
  elements.signOut.addEventListener("click", function () {
    // Hide owner presentation immediately; Clerk remains the only session authority.
    showOwnerAuthenticationState(elements, "signed-out");
    return clerk.signOut();
  });
  clerk.addListener(update);
  update({ user: clerk.user });
}

function loadClerkBrowserSdk(documentObject, publishableKey) {
  return new Promise(function (resolve, reject) {
    const script = documentObject.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkPublishableKey = publishableKey;
    script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
    script.addEventListener("load", resolve);
    script.addEventListener("error", reject);
    documentObject.head.appendChild(script);
  });
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
    if (!clerk || typeof clerk.load !== "function") throw new Error("Clerk did not load");
    await clerk.load();

    bindOwnerClerkSession(clerk, documentObject, storage, elements);
    // Clerk's browser SDK manages its same-origin session; DEMEOS never copies or stores its tokens.
  } catch (error) {
    showOwnerAuthenticationState(elements, "error");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getOwnerWorkspaceContext, migrateWorkspaceBusinessContext, showOwnerAuthenticationState,
    renderOwnerWorkspace, bindOwnerClerkSession, initialiseOwnerAuthentication
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  initialiseOwnerAuthentication(window, document, localStorage, window.fetch.bind(window));
});
