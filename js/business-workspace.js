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

const unavailableOwnerNextAction = {
  title: "Next action unavailable",
  explanation: "DEMEOS could not confirm your current marketing state.",
  action: "Open Marketing",
  destination: "index.html"
};

function getTrustedOwnerNextAction(record, activeBusinessId) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
    !record.businessProfile || record.businessProfile.businessId !== activeBusinessId ||
    !Array.isArray(record.campaigns)) return unavailableOwnerNextAction;

  const campaigns = record.campaigns.filter(function (campaign) {
    return campaign && typeof campaign === "object" && !Array.isArray(campaign) &&
      campaign.businessId === activeBusinessId;
  });
  if (campaigns.some(function (campaign) { return campaign.approvalStatus === "Unapproved"; })) {
    return {
      title: "Review your campaign",
      explanation: "Marketing work is waiting for your approval or revision.",
      action: "Review Campaign",
      destination: "index.html#campaigns"
    };
  }
  if (campaigns.some(function (campaign) {
    return campaign.approvalStatus === "Approved" &&
      (!campaign.outcome || typeof campaign.outcome.outcome !== "string" ||
        !campaign.outcome.outcome.trim() || campaign.outcome.outcome === "Not used yet");
  })) {
    return {
      title: "Record what happened",
      explanation: "Approved marketing is waiting for your real-world outcome before DEMEOS can learn from it.",
      action: "Record Outcome",
      destination: "index.html#campaigns"
    };
  }
  const meaningfulOutcomes = new Set(["Positive", "Mixed", "No noticeable result"]);
  if (campaigns.some(function (campaign) {
    return campaign.outcome && meaningfulOutcomes.has(campaign.outcome.outcome);
  })) {
    return {
      title: "Ask DEMEOS what to do next",
      explanation: "DEMEOS can use your Business Profile, recorded outcomes and previous owner decisions to recommend the next marketing action.",
      action: "Get Recommendations",
      destination: "index.html#recommends"
    };
  }
  if (!campaigns.length) {
    return {
      title: "Create your first marketing work",
      explanation: "Your Business Profile is ready. Start supported marketing when you are ready.",
      action: "Create Marketing",
      destination: "index.html#create"
    };
  }
  return unavailableOwnerNextAction;
}

function renderOwnerNextAction(documentObject, nextAction) {
  const container = documentObject.getElementById("workspace-next-action");
  if (!container) return;
  container.replaceChildren();
  const title = documentObject.createElement("strong");
  const explanation = documentObject.createElement("p");
  const action = documentObject.createElement("a");
  title.textContent = nextAction.title;
  explanation.textContent = nextAction.explanation;
  action.textContent = nextAction.action;
  action.href = nextAction.destination;
  action.className = "demeos-primary-button owner-card-action";
  container.append(title, explanation, action);
}

async function loadOwnerNextAction(documentObject, storage, fetchFunction) {
  const activeBusinessId = storage && typeof storage.getItem === "function"
    ? storage.getItem("demeosActiveBusinessId") : null;
  if (!activeBusinessId || typeof fetchFunction !== "function") {
    renderOwnerNextAction(documentObject, unavailableOwnerNextAction);
    return unavailableOwnerNextAction;
  }
  try {
    const response = await fetchFunction(`/api/businesses/${encodeURIComponent(activeBusinessId)}`, {
      method: "GET", credentials: "same-origin"
    });
    if (!response.ok) throw new Error("Business record unavailable");
    const nextAction = getTrustedOwnerNextAction(await response.json(), activeBusinessId);
    renderOwnerNextAction(documentObject, nextAction);
    return nextAction;
  } catch (_error) {
    renderOwnerNextAction(documentObject, unavailableOwnerNextAction);
    return unavailableOwnerNextAction;
  }
}

function bindOwnerClerkSession(clerk, documentObject, storage, elements, fetchFunction) {
  const update = function (auth) {
    if (auth && auth.user) {
      renderOwnerWorkspace(documentObject, storage);
      if (typeof fetchFunction === "function") {
        loadOwnerNextAction(documentObject, storage, fetchFunction);
      }
      showOwnerAuthenticationState(elements, "signed-in");
      return;
    }
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
    bindOwnerClerkSession(clerk, documentObject, storage, elements, fetchFunction);
  } catch (error) {
    showOwnerAuthenticationState(elements, "error");
  }
}

const ownerBusinessPendingSyncKey = "demeosPendingBusinessProfileSync";
const ownerNewBusinessAttemptKey = "demeosPendingNewBusinessId";

function readOwnerPendingSyncIds(storage) {
  if (!storage || typeof storage.getItem !== "function") return [];
  const raw = storage.getItem(ownerBusinessPendingSyncKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(function (id) { return typeof id === "string" && id; }) : [];
  } catch (_error) {
    return typeof raw === "string" && raw.trim() ? [raw.trim()] : [];
  }
}

function mergeServerAuthorizedProfiles(cachedProfiles, serverBusinesses, selectedBusinessId, pendingIds) {
  const pending = new Set(Array.isArray(pendingIds) ? pendingIds : []);
  const cachedById = new Map((Array.isArray(cachedProfiles) ? cachedProfiles : []).filter(function (profile) {
    return profile && typeof profile.businessId === "string" && profile.businessId;
  }).map(function (profile) { return [profile.businessId, profile]; }));
  const profiles = (Array.isArray(serverBusinesses) ? serverBusinesses : []).filter(function (profile) {
    return profile && typeof profile.businessId === "string" && profile.businessId;
  }).map(function (serverProfile) {
    const cached = cachedById.get(serverProfile.businessId) || {};
    return pending.has(serverProfile.businessId)
      ? { ...serverProfile, ...cached, businessId: serverProfile.businessId }
      : { ...cached, ...serverProfile, businessId: serverProfile.businessId };
  });
  const activeBusinessId = profiles.some(function (profile) { return profile.businessId === selectedBusinessId; })
    ? selectedBusinessId : (profiles[0] ? profiles[0].businessId : null);
  return { profiles, activeBusinessId };
}

function getStickyNewBusinessId(storage, createId) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return createId();
  const existing = storage.getItem(ownerNewBusinessAttemptKey);
  if (typeof existing === "string" && existing) return existing;
  const businessId = createId();
  storage.setItem(ownerNewBusinessAttemptKey, businessId);
  return businessId;
}

function clearStickyNewBusinessId(storage) {
  if (storage && typeof storage.removeItem === "function") storage.removeItem(ownerNewBusinessAttemptKey);
}

function getRequestUrl(input) {
  if (typeof input === "string") return input;
  return input && typeof input.url === "string" ? input.url : "";
}

function getRequestMethod(input, init) {
  if (init && typeof init.method === "string") return init.method.toUpperCase();
  if (input && typeof input.method === "string") return input.method.toUpperCase();
  return "GET";
}

function installOwnerBusinessSecurity(windowObject, documentObject, localStorageObject, attemptStorageObject) {
  if (!windowObject || !documentObject || typeof windowObject.fetch !== "function") return;

  let resolveOwnerAuthReady;
  const ownerAuthReady = new Promise(function (resolve) { resolveOwnerAuthReady = resolve; });
  let authenticatedOnThisPage = false;
  let currentIdentityId = null;
  const originalFetch = windowObject.fetch.bind(windowObject);

  windowObject.fetch = async function (input, init) {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    if (url === "/api/businesses" && method === "GET") await ownerAuthReady;
    try {
      const response = await originalFetch(input, init);
      const match = method === "PUT" && typeof url === "string"
        ? url.match(/^\/api\/businesses\/([^/?]+)$/) : null;
      if (match && attemptStorageObject) {
        const attemptedId = attemptStorageObject.getItem(ownerNewBusinessAttemptKey);
        if (attemptedId && decodeURIComponent(match[1]) === attemptedId && response.ok) {
          clearStickyNewBusinessId(attemptStorageObject);
        } else if (attemptedId && decodeURIComponent(match[1]) === attemptedId &&
          [400, 403, 409].includes(response.status)) {
          clearStickyNewBusinessId(attemptStorageObject);
        }
      }
      return response;
    } catch (error) {
      // Preserve the attempted ID after ambiguous network failure so a retry cannot create a duplicate.
      throw error;
    }
  };

  const originalBindOwnerClerkSession = windowObject.bindOwnerClerkSession;
  if (typeof originalBindOwnerClerkSession === "function") {
    windowObject.bindOwnerClerkSession = function (clerk, ownerDocument, storage, elements, fetchFunction) {
      const handleTrustedSessionChange = function (auth) {
        const user = auth && auth.user;
        const identityId = user && typeof user.id === "string" ? user.id : null;
        const selector = ownerDocument.getElementById("business-selector");

        if (!identityId) {
          if (selector) {
            selector.textContent = "";
            selector.disabled = true;
          }
          if (authenticatedOnThisPage) currentIdentityId = null;
          return;
        }

        if (authenticatedOnThisPage && (currentIdentityId === null || currentIdentityId !== identityId)) {
          if (selector) {
            selector.textContent = "";
            selector.disabled = true;
          }
          windowObject.location.reload();
          return;
        }

        currentIdentityId = identityId;
        authenticatedOnThisPage = true;
        resolveOwnerAuthReady();
      };

      clerk.addListener(handleTrustedSessionChange);
      handleTrustedSessionChange({ user: clerk.user });
      return originalBindOwnerClerkSession(clerk, ownerDocument, storage, elements, fetchFunction);
    };
  }

  if (typeof windowObject.applyAuthorizedBusinessProfiles === "function") {
    windowObject.applyAuthorizedBusinessProfiles = function (cachedProfiles, serverBusinesses, selectedBusinessId) {
      return mergeServerAuthorizedProfiles(cachedProfiles, serverBusinesses, selectedBusinessId,
        readOwnerPendingSyncIds(localStorageObject));
    };
  }

  const originalCreateBusinessId = windowObject.createBusinessId;
  if (typeof originalCreateBusinessId === "function") {
    windowObject.createBusinessId = function () {
      return getStickyNewBusinessId(attemptStorageObject, originalCreateBusinessId);
    };
  }

  const addBusinessButton = documentObject.getElementById("add-business-btn");
  if (addBusinessButton && typeof addBusinessButton.addEventListener === "function") {
    addBusinessButton.addEventListener("click", function () {
      clearStickyNewBusinessId(attemptStorageObject);
    }, true);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getOwnerWorkspaceContext, migrateWorkspaceBusinessContext, showOwnerAuthenticationState,
    renderOwnerWorkspace, bindOwnerClerkSession, initialiseOwnerAuthentication,
    getTrustedOwnerNextAction, renderOwnerNextAction, loadOwnerNextAction,
    getOwnerNavigationSection, updateOwnerNavigation, syncOwnerWorkspaceFromLocation,
    readOwnerPendingSyncIds, mergeServerAuthorizedProfiles, getStickyNewBusinessId, clearStickyNewBusinessId
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  installOwnerBusinessSecurity(window, document, localStorage, localStorage);
});

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  updateOwnerNavigation(document, window.location);
  syncOwnerWorkspaceFromLocation(document, window.location);
  window.addEventListener("hashchange", function () {
    syncOwnerWorkspaceFromLocation(document, window.location);
  });
  initialiseOwnerAuthentication(window, document, localStorage, window.fetch.bind(window));
});
