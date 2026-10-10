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
  if (view === "products") return "products";
  if (view === "product-options") return "product-options";
  if (view === "inventory") return "inventory";
  if (view === "orders") return "orders";
  return "marketing";
}

function updateOwnerNavigation(documentObject, locationObject, workspaceView) {
  let activeSection = getOwnerNavigationSection(locationObject, workspaceView);
  const links = documentObject.querySelectorAll(".owner-workspace-navigation [data-owner-section]");
  if (activeSection === "product-options" && !Array.from(links).some(link => link.getAttribute("data-owner-section") === "product-options")) activeSection = "products";
  links.forEach(function (link) {
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
      status: campaign.preparationOnly ? (campaign.ownerReviewState === "submitted" ? "Submitted for review" : "Private draft") : campaign.approvalStatus || "Status not recorded"
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

function renderOwnerWorkspace(documentObject, storage, applicationStatus) {
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
    identity.textContent = "Start with your business details.";
    work.textContent = "Set up your business privately, then continue preparation.";
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
  const saved = documentObject.createElement("span"); saved.textContent = context.profile.informationStatus?.reviewState === "submitted" ? "Submitted privately. Awaiting administrative review; approval is not granted." : "Private preparation. Business approval is not recorded."; if (applicationStatus === "reviewed") saved.textContent = "Review completed. Business approval and activation are not granted.";
  if (applicationStatus === "changes-requested") saved.textContent = "Changes requested. Edit, save and resubmit your information."; identity.appendChild(saved);
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
  destination: "marketing.html"
};

function getTrustedOwnerNextAction(record, activeBusinessId) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
    !record.businessProfile || record.businessProfile.businessId !== activeBusinessId ||
    !Array.isArray(record.campaigns)) return unavailableOwnerNextAction;

  if (Object.prototype.hasOwnProperty.call(record, "workspaceReadiness")) {
    const views = getOwnerModelViews(record.workspaceReadiness, activeBusinessId);
    if (!views.length) return unavailableOwnerNextAction;
    if (!views.some(view => view.id === "marketing")) return {title:"Review your products", explanation:"Prepare accurate prices, choices and availability. Selling remains subject to your existing permissions.", action:"Review products", destination:"marketing.html#products"};
  }
  const campaigns = record.campaigns.filter(function (campaign) {
    return campaign && typeof campaign === "object" && !Array.isArray(campaign) &&
      campaign.businessId === activeBusinessId;
  });
  if (campaigns.some(function (campaign) { return campaign.approvalStatus === "Unapproved" && campaign.ownerReviewState !== "submitted"; })) {
    return {
      title: "Review your campaign",
      explanation: "Review the facts and save any edits before submitting your private draft for administrative review.",
      action: "Review drafts",
      destination: "marketing.html#campaigns"
    };
  }
  if (campaigns.some(function (campaign) {return campaign.preparationOnly === true && campaign.ownerReviewState === "submitted";})) {
    return {title:"Draft submitted for review", explanation:"Your reviewed draft remains private. Publication review is not available yet; you can continue preparing your business information.", action:"Review submitted draft", destination:"marketing.html#campaigns"};
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
      destination: "marketing.html#campaigns"
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
      destination: "marketing.html#recommends"
    };
  }
  if (!campaigns.length) {
    if (Array.isArray(record.businessProfile.products) && !record.businessProfile.products.some(product => product?.productId)) {
      return {title:"Add your first product or service", explanation:"Add accurate details, prices and matching photos or videos, then save your offer before preparing marketing.", action:"Add a product or service", destination:"marketing.html#products"};
    }
    return {
      title: "Create your first marketing work",
      explanation: "Your Business Profile is ready. Start supported marketing when you are ready.",
      action: "Create Marketing",
      destination: "marketing.html#create"
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

const ownerOverviewLoads = new WeakMap();
async function loadOwnerNextAction(documentObject, storage, fetchFunction) {
  const generation = (ownerOverviewLoads.get(documentObject) || 0) + 1;
  ownerOverviewLoads.set(documentObject, generation);
  const activeBusinessId = storage && typeof storage.getItem === "function"
    ? storage.getItem("demeosActiveBusinessId") : null;
  if (!activeBusinessId || typeof fetchFunction !== "function") {
    renderOwnerNextAction(documentObject, {title:"Set up your business", explanation:"Add your business details, review them and submit privately. Approval is a separate step.", action:"Start business setup", destination:"marketing.html#business-profile"});
    renderOwnerWorkspace(documentObject, {getItem() {return null;}});
    renderOwnerModels(documentObject, null, null);
    renderOwnerDashboardSummary(documentObject, null, null);
    return unavailableOwnerNextAction;
  }
  try {
    const response = await fetchFunction(`/api/businesses/${encodeURIComponent(activeBusinessId)}`, {
      method: "GET", credentials: "same-origin"
    });
    if (!response.ok) { const error = new Error("Business record unavailable"); error.status = response.status; throw error; }
    const record = await response.json();
    // Discard responses for a business that is no longer selected.
    if (ownerOverviewLoads.get(documentObject) !== generation || storage.getItem("demeosActiveBusinessId") !== activeBusinessId) return unavailableOwnerNextAction;
    if (record.businessProfile?.businessId !== activeBusinessId) throw new Error("Business identity unavailable");
    const nextAction = getTrustedOwnerNextAction(record, activeBusinessId);
    renderOwnerDashboardSummary(documentObject, record, activeBusinessId);
    if (record.businessProfile?.businessId === activeBusinessId) {
      const serverStorage = {getItem(key) {return key === "demeosBusinessProfiles" ? JSON.stringify([record.businessProfile]) : key === "demeosActiveBusinessId" ? activeBusinessId : key === "demeosCampaignHistory" ? JSON.stringify(record.campaigns || []) : null;}};
      renderOwnerWorkspace(documentObject, serverStorage, record.workspaceReadiness?.onboarding?.status);
      renderOwnerModels(documentObject, record.workspaceReadiness, activeBusinessId, record);
    }
    const model = typeof window !== "undefined" ? window.DEMEOSOwnerWorkspace?.getState(documentObject) : null;
    const action = model?.model === "selling" ? {title: "Prepare your catalogue", explanation: "Review prices, product options and availability.", action: "Open catalogue", destination: "marketing.html#products"}
      : model && model.status !== "ready" ? {title: window.DEMEOSOwnerWorkspace.messages[model.status][0], explanation: window.DEMEOSOwnerWorkspace.messages[model.status][1], action: "Review My Business", destination: "marketing.html#business-profile"} : nextAction;
    if (model?.model === "selling") {
      const work = documentObject.getElementById("workspace-current-work");
      if (work) { work.replaceChildren(); const products = Array.isArray(record.businessProfile.products) ? record.businessProfile.products : [];
        const heading = documentObject.getElementById("current-work-heading"); if (heading) heading.textContent = "Your catalogue";
        if (!products.length) work.textContent = "No saved products yet.";
        for (const product of products.slice(0,3)) { const row=documentObject.createElement("article"), title=documentObject.createElement("strong"), detail=documentObject.createElement("span"); title.textContent=product.name; detail.textContent=[product.price,product.availability].filter(Boolean).join(" · ");row.append(title,detail);work.appendChild(row); }
      }
    } else { const heading=documentObject.getElementById("current-work-heading"); if(heading)heading.textContent="Current work"; }
    renderOwnerNextAction(documentObject, action);
    return action;
  } catch (_error) {
    if (ownerOverviewLoads.get(documentObject) !== generation || storage.getItem("demeosActiveBusinessId") !== activeBusinessId) return unavailableOwnerNextAction;
    const identity = documentObject.getElementById("workspace-business-identity");
    const work = documentObject.getElementById("workspace-current-work");
    if (identity) identity.textContent = "Business information could not be confirmed.";
    if (work) work.textContent = "Current activity is unavailable. Open Marketing to retry.";
    renderOwnerModels(documentObject, null, activeBusinessId, null, _error.status === 403 ? "forbidden" : "unavailable");
    renderOwnerDashboardSummary(documentObject, null, activeBusinessId);
    renderOwnerNextAction(documentObject, {title: _error.status === 403 ? "Business access unavailable" : "Workspace could not be loaded", explanation: "Try again or review your business details.", action: "Review My Business", destination: "marketing.html#business-profile"});
    return unavailableOwnerNextAction;
  }
}

// Presentation describes existing workflows; only matching server readiness enables a next action.
const ownerModelDescriptions = [
  {id: "marketing", title: "Marketing through DEMEOS",
   description: "Customers buy, book or enquire directly with your business through its approved destination.",
   action: "Prepare marketing", destination: "marketing.html#create"},
  {id: "selling", title: "Selling through DEMEOS",
   description: "Prepare products for DEMEOS purchases. Selling and payments need separate authorisation and cannot be activated here.",
   action: "Prepare products", destination: "marketing.html#products"}
];

function getOwnerModelPresentations(readiness, businessId) {
  const confirmed = !!businessId && readiness?.businessId === businessId;
  return ownerModelDescriptions.map(model => {
    const permission = confirmed ? readiness[model.id] : null;
    const available = permission?.canPrepare === true;
    let status = "Preparation permission could not be confirmed.";
    if (permission?.canPrepare === false) status = "Preparation is not authorised for this business.";
    if (available && model.id === "marketing") status = "Marketing preparation available · £149 per month";
    if (available && model.id === "selling") status = permission.canSell === true
      ? "Selling permission confirmed" : permission.canSell === false
      ? "Preparation only. Selling is not enabled." : "Selling permission could not be confirmed.";
    return {...model, available, status};
  });
}

function getOwnerModelViews(readiness, businessId) {
  return getOwnerModelPresentations(readiness, businessId).filter(model => model.available);
}

function renderOwnerModels(documentObject, readiness, businessId, record, failure) {
  if (typeof window !== "undefined" && window.DEMEOSOwnerWorkspace)
    return window.DEMEOSOwnerWorkspace.apply(documentObject, record || {businessProfile:{businessId}, workspaceReadiness:readiness}, businessId, failure);
}

function renderOwnerDashboardSummary(documentObject, record, businessId) {
  const container = documentObject.getElementById("owner-dashboard-summary");
  if (!container) return;
  container.replaceChildren();
  if (!record || record.businessProfile?.businessId !== businessId || !Array.isArray(record.campaigns)) {
    container.textContent = "Recorded activity could not be confirmed. Reload to retry."; return;
  }
  const campaigns = record.campaigns.filter(item => item?.businessId === businessId);
  const metrics = typeof window !== "undefined" ? window.DEMEOSOwnerResults?.getOwnerActivityMetrics(record, businessId) : require("./business-results.js").getOwnerActivityMetrics(record, businessId);
  const cards = [
    {label:"Drafts to review", value:campaigns.filter(item => item.approvalStatus === "Unapproved" && item.ownerReviewState !== "submitted").length, detail:"Drafts awaiting your review among up to 20 recent campaigns. Submission keeps them private."},
    metrics?.[2], {label:"External enquiries and verified sales", value:null, detail:"Not recorded here. Customer interest is reported separately."}
  ].filter(Boolean);
  cards.forEach(metric => {
    const card = documentObject.createElement("article"); card.className = "owner-metric";
    for (const [tag,text] of [["h3",metric.label],["strong",metric.value === null ? "Not recorded" : String(metric.value)],["p",metric.detail]]) {
      const element = documentObject.createElement(tag); element.textContent = text; card.appendChild(element);
    }
    container.appendChild(card);
  });
}

function bindOwnerClerkSession(clerk, documentObject, storage, elements, fetchFunction) {
  const update = function (auth) {
    if (auth && auth.user) {
      showOwnerAuthenticationState(elements, "signed-in");
      const authenticatedUserId = auth.user.id;
      syncAuthorizedOwnerBusinessContext(storage, fetchFunction).then(function (context) {
        // An earlier request must not render after sign-out or an account switch.
        if (!clerk.user || clerk.user.id !== authenticatedUserId) return;
        if (typeof documentObject.dispatchEvent === "function") documentObject.dispatchEvent(new CustomEvent("owner-business-ready"));
        if (context.failed) renderOwnerModels(documentObject, null, storage.getItem("demeosActiveBusinessId"), null, "unavailable");
        else if (typeof fetchFunction === "function") loadOwnerNextAction(documentObject, storage, fetchFunction);
      });
      return;
    }
    // A temporarily missing user while Clerk still has a session is not a sign-out.
    // Keep private content hidden while the session finishes restoring.
    showOwnerAuthenticationState(elements, clerk.session ? "loading" : "signed-out");
  };

  // One sign-in entry point: Clerk presents the configured account methods in one dialog.
  elements.signIn.addEventListener("click", function () {
    return clerk.openSignIn();
  });
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
    if (windowObject.location && new URLSearchParams(windowObject.location.search).get("clerk_oauth_callback") === "1") {
      await clerk.handleRedirectCallback({
        signInFallbackRedirectUrl: "/business-workspace.html",
        signUpFallbackRedirectUrl: "/business-workspace.html"
      });
    }
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

async function syncAuthorizedOwnerBusinessContext(storage, fetchFunction) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" ||
      typeof fetchFunction !== "function") return { profiles: [], activeBusinessId: null };
  try {
    const response = await fetchFunction("/api/businesses", { credentials: "same-origin" });
    if (!response.ok) return { profiles: [], activeBusinessId: null, failed: true };
    const payload = await response.json();
    const cached = parseWorkspaceValue(storage, "demeosBusinessProfiles", []);
    const merged = mergeServerAuthorizedProfiles(
      cached,
      payload && Array.isArray(payload.businesses) ? payload.businesses : [],
      storage.getItem("demeosActiveBusinessId"),
      readOwnerPendingSyncIds(storage)
    );
    storage.setItem("demeosBusinessProfiles", JSON.stringify(merged.profiles));
    if (merged.activeBusinessId) storage.setItem("demeosActiveBusinessId", merged.activeBusinessId);
    else if (typeof storage.removeItem === "function") storage.removeItem("demeosActiveBusinessId");
    return merged;
  } catch (_error) {
    return { profiles: [], activeBusinessId: null, failed: true };
  }
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
    if (/^\/api\/businesses(?:\/|$)/.test(url) && method === "GET") await ownerAuthReady;
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
          // Clerk can emit a temporary empty user while restoring a session.
          // Do not discard the previous identity or force a reload on restoration.
          return;
        }

        if (authenticatedOnThisPage && currentIdentityId !== null && currentIdentityId !== identityId) {
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
      const boundSession = originalBindOwnerClerkSession(clerk, ownerDocument, storage, elements, fetchFunction);
      if (clerk.user) resolveOwnerAuthReady();
      return boundSession;
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
    getOwnerModelViews, getOwnerModelPresentations, renderOwnerDashboardSummary, renderOwnerModels, getOwnerWorkspaceContext, migrateWorkspaceBusinessContext, showOwnerAuthenticationState,
    renderOwnerWorkspace, bindOwnerClerkSession, initialiseOwnerAuthentication,
    getTrustedOwnerNextAction, renderOwnerNextAction, loadOwnerNextAction,
    getOwnerNavigationSection, updateOwnerNavigation, syncOwnerWorkspaceFromLocation,
    readOwnerPendingSyncIds, mergeServerAuthorizedProfiles, syncAuthorizedOwnerBusinessContext, getStickyNewBusinessId, clearStickyNewBusinessId
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("admin-application-review")) return;
  installOwnerBusinessSecurity(window, document, localStorage, localStorage);
});

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("admin-application-review")) return;
  updateOwnerNavigation(document, window.location);
  syncOwnerWorkspaceFromLocation(document, window.location);
  window.addEventListener("hashchange", function () {
    syncOwnerWorkspaceFromLocation(document, window.location);
  });
  initialiseOwnerAuthentication(window, document, localStorage, window.fetch.bind(window));
});
