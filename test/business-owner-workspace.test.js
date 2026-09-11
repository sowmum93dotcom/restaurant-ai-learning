const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  getOwnerWorkspaceContext, showOwnerAuthenticationState, bindOwnerClerkSession, renderOwnerWorkspace
} = require("../js/business-workspace.js");
const html = fs.readFileSync(require.resolve("../business-workspace.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/business-workspace.js"), "utf8");

function storage(values) {
  const state = { ...values };
  return {
    getItem: function (key) { return Object.hasOwn(state, key) ? state[key] : null; },
    setItem: function (key, value) { state[key] = String(value); },
    removeItem: function (key) { delete state[key]; },
    state
  };
}

test("workspace navigation contains the five owner-facing sections", function () {
  const navigation = html.match(/<nav class="owner-workspace-navigation"[\s\S]*?<\/nav>/);
  assert.ok(navigation, "Owner workspace navigation should exist");
  const labels = Array.from(navigation[0].matchAll(/<a[^>]*>([^<]+)<\/a>/g), function (match) { return match[1]; });
  assert.deepEqual(labels, ["Overview", "Business Profile", "DEMEOS Recommends", "Marketing", "Results"]);
  assert.match(html, /aria-label="Business Owner Workspace"/);
});

test("owner navigation reuses existing owner functionality", function () {
  assert.match(html, /href="index\.html#business-profile">Business Profile<\/a>/);
  assert.match(html, /href="index\.html#recommends">DEMEOS Recommends<\/a>/);
  assert.match(html, /href="index\.html">Marketing<\/a>/);
  assert.match(html, /href="business-results\.html">Results<\/a>/);
  assert.doesNotMatch(html, /iframe|data-workspace-view|id="recommendations-btn"|id="generate-btn"/);
});

test("workspace limits overview rendering to the selected browser business context", function () {
  const context = getOwnerWorkspaceContext(storage({
    demeosActiveBusinessId: "business-a",
    demeosBusinessProfiles: JSON.stringify([
      { businessId: "business-a", name: "Cafe A", type: "Cafe", location: "Leeds" },
      { businessId: "business-b", name: "Private Rival" }
    ]),
    demeosCampaignHistory: JSON.stringify([
      { businessId: "business-a", promoText: "Autumn menu", approvalStatus: "Approved" },
      { businessId: "business-b", promoText: "Rival plans", approvalStatus: "Draft" }
    ])
  }));
  assert.equal(context.profile.name, "Cafe A");
  assert.deepEqual(context.currentWork, [{ name: "Autumn menu", status: "Approved" }]);
  assert.doesNotMatch(JSON.stringify(context), /Private Rival|Rival plans/);
});

test("workspace shows the newest three stored campaigns", function () {
  const context = getOwnerWorkspaceContext(storage({
    demeosActiveBusinessId: "business-a",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-a", name: "Cafe A" }]),
    demeosCampaignHistory: JSON.stringify([
      { businessId: "business-a", promoText: "Newest", approvalStatus: "Approved" },
      { businessId: "business-a", promoText: "Second", approvalStatus: "Draft" },
      { businessId: "business-a", promoText: "Third", approvalStatus: "Approved" },
      { businessId: "business-a", promoText: "Oldest", approvalStatus: "Approved" }
    ])
  }));
  assert.deepEqual(context.currentWork.map(function (item) { return item.name; }), ["Newest", "Second", "Third"]);
});

test("workspace migrates a legacy single business profile before rendering", function () {
  const local = storage({
    demeosBusinessProfile: JSON.stringify({ businessId: "legacy-a", name: "Legacy Cafe", type: "Cafe" }),
    demeosCampaignHistory: JSON.stringify([{ businessId: "legacy-a", promoText: "Legacy campaign", approvalStatus: "Approved" }])
  });
  const context = getOwnerWorkspaceContext(local);
  assert.equal(context.profile.name, "Legacy Cafe");
  assert.equal(context.currentWork[0].name, "Legacy campaign");
  assert.equal(local.getItem("demeosActiveBusinessId"), "legacy-a");
  assert.equal(JSON.parse(local.getItem("demeosBusinessProfiles"))[0].businessId, "legacy-a");
});

test("workspace shell does not claim browser filtering is authorization", function () {
  assert.doesNotMatch(html, /Private business workspace|Private business context/);
  assert.match(html, /Business owner workspace/);
  assert.match(html, /Selected business context/);
});

test("workspace exposes no admin controls, invented metrics, or unsupported capabilities", function () {
  const source = `${html}\n${script}`;
  assert.doesNotMatch(source, /DEMEOS Admin|admin control|customer identity|booking|ordering|CRM|loyalty|payments/i);
  assert.doesNotMatch(source, /revenue|ROI|conversion rate|forecast|analytics|recommendationTitle|demeosCapability/i);
  assert.doesNotMatch(source, /Add Business|business-selector/);
});

function createRenderDocument() {
  const elements = {
    "workspace-business-identity": {
      children: [], textContent: "",
      replaceChildren: function () { this.children = []; this.textContent = ""; },
      appendChild: function (child) { this.children.push(child); }
    },
    "workspace-current-work": {
      children: [], textContent: "",
      replaceChildren: function () { this.children = []; this.textContent = ""; },
      appendChild: function (child) { this.children.push(child); }
    },
    "workspace-header-business": { textContent: "" },
    "owner-ownership-confirmation": { hidden: true },
    "owner-confirm-ownership": { disabled: false, onclick: null },
    "owner-ownership-confirmation-status": { textContent: "" }
  };
  return {
    elements,
    getElementById: function (id) { return elements[id]; },
    createElement: function (tagName) {
      return {
        tagName: tagName.toUpperCase(), textContent: "", children: [],
        append: function (...children) { this.children.push(...children); }
      };
    }
  };
}

test("workspace renders the exact selected business ID only when diagnostic config is enabled", function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-exact-123",
    demeosBusinessProfiles: JSON.stringify([
      { businessId: "business-exact-123", name: "Test Kitchen London", type: "Restaurant", location: "Greenwich, London" }
    ])
  });

  renderOwnerWorkspace(documentObject, local, { businessIdDiagnosticEnabled: true });

  const diagnostic = documentObject.elements["workspace-business-identity"].children.find(function (child) {
    return child.tagName === "SMALL";
  });
  assert.ok(diagnostic);
  assert.equal(diagnostic.textContent, "Business ID: business-exact-123");
});

test("workspace hides the business ID diagnostic by default", function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-secret-123",
    demeosBusinessProfiles: JSON.stringify([
      { businessId: "business-secret-123", name: "Test Kitchen London" }
    ])
  });

  renderOwnerWorkspace(documentObject, local);

  assert.equal(documentObject.elements["workspace-business-identity"].children.some(function (child) {
    return child.tagName === "SMALL" && child.textContent.startsWith("Business ID:");
  }), false);
});

test("workspace omits the business ID diagnostic when the selected profile has no business ID", function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "",
    demeosBusinessProfiles: JSON.stringify([{ name: "Profile without ID" }])
  });

  renderOwnerWorkspace(documentObject, local, { businessIdDiagnosticEnabled: true });

  const diagnostics = documentObject.elements["workspace-business-identity"].children.filter(function (child) {
    return child.tagName === "SMALL" && child.textContent.startsWith("Business ID:");
  });
  assert.equal(diagnostics.length, 0);
});

test("ownership confirmation control is hidden when diagnostic mode is off", function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }])
  });

  renderOwnerWorkspace(documentObject, local, { businessIdDiagnosticEnabled: false });

  assert.equal(documentObject.elements["owner-ownership-confirmation"].hidden, true);
  assert.equal(documentObject.elements["owner-confirm-ownership"].onclick, null);
});

test("ownership confirmation control is shown in diagnostic mode for a selected business ID", function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }])
  });

  renderOwnerWorkspace(documentObject, local, {
    businessIdDiagnosticEnabled: true,
    fetchFunction: async function () {}
  });

  assert.equal(documentObject.elements["owner-ownership-confirmation"].hidden, false);
  assert.equal(typeof documentObject.elements["owner-confirm-ownership"].onclick, "function");
  assert.match(html, />Confirm Business Ownership<\/button>/);
});

test("ownership confirmation sends only the selected business ID and shows success", async function () {
  const documentObject = createRenderDocument();
  const requests = [];
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }])
  });
  renderOwnerWorkspace(documentObject, local, {
    businessIdDiagnosticEnabled: true,
    fetchFunction: async function (url, options) {
      requests.push({ url, options });
      assert.equal(documentObject.elements["owner-confirm-ownership"].disabled, true);
      return { status: 200, json: async function () { return { ownershipAssigned: true }; } };
    }
  });

  await documentObject.elements["owner-confirm-ownership"].onclick();

  assert.deepEqual(requests, [{
    url: "/api/businesses/bootstrap-owner",
    options: {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: "business-selected" })
    }
  }]);
  assert.equal(Object.keys(JSON.parse(requests[0].options.body)).length, 1);
  assert.equal(documentObject.elements["owner-ownership-confirmation-status"].textContent, "Business ownership confirmed.");
  assert.equal(documentObject.elements["owner-confirm-ownership"].disabled, false);
});

test("ownership confirmation shows the server error for a non-200 response", async function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }])
  });
  renderOwnerWorkspace(documentObject, local, {
    businessIdDiagnosticEnabled: true,
    fetchFunction: async function () {
      return { status: 403, json: async function () { return { error: "Ownership bootstrap is not authorized." }; } };
    }
  });

  await documentObject.elements["owner-confirm-ownership"].onclick();

  assert.equal(
    documentObject.elements["owner-ownership-confirmation-status"].textContent,
    "Ownership bootstrap is not authorized."
  );
  assert.equal(documentObject.elements["owner-confirm-ownership"].disabled, false);
});

test("ownership confirmation uses the generic message for a network failure", async function () {
  const documentObject = createRenderDocument();
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }])
  });
  renderOwnerWorkspace(documentObject, local, {
    businessIdDiagnosticEnabled: true,
    fetchFunction: async function () { throw new Error("private network detail"); }
  });

  await documentObject.elements["owner-confirm-ownership"].onclick();

  const message = documentObject.elements["owner-ownership-confirmation-status"].textContent;
  assert.equal(message, "DEMEOS could not confirm business ownership.");
  assert.doesNotMatch(message, /private|network|detail/i);
});

test("ownership confirmation neither renders nor sends Clerk identity or auth details", async function () {
  const documentObject = createRenderDocument();
  let serializedRequest = "";
  const local = storage({
    demeosActiveBusinessId: "business-selected",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-selected", name: "Selected Cafe" }]),
    clerkUserId: "user_private",
    token: "token_private",
    session: "session_private",
    actorScope: "owner_private"
  });
  renderOwnerWorkspace(documentObject, local, {
    businessIdDiagnosticEnabled: true,
    fetchFunction: async function (url, options) {
      serializedRequest = JSON.stringify({ url, options });
      return { status: 200, json: async function () { return { ownershipAssigned: true }; } };
    }
  });

  await documentObject.elements["owner-confirm-ownership"].onclick();

  const rendered = JSON.stringify(documentObject.elements);
  assert.doesNotMatch(`${serializedRequest}\n${rendered}`, /user_private|token_private|session_private|owner_private/);
  assert.deepEqual(JSON.parse(JSON.parse(serializedRequest).options.body), { businessId: "business-selected" });
});

function authenticationElements() {
  return {
    loading: { hidden: false }, signedOut: { hidden: true }, signedIn: { hidden: true },
    error: { hidden: true }, account: { hidden: true }
  };
}

test("signed-out authentication state hides workspace and presents sign-in", function () {
  const elements = authenticationElements();
  showOwnerAuthenticationState(elements, "signed-out");
  assert.equal(elements.signedIn.hidden, true);
  assert.equal(elements.signedOut.hidden, false);
  assert.match(html, /id="owner-sign-in"[^>]*>Sign in</);
});

test("signed-in authentication state reveals workspace and sign-out control", function () {
  const elements = authenticationElements();
  showOwnerAuthenticationState(elements, "signed-in");
  assert.equal(elements.signedIn.hidden, false);
  assert.equal(elements.account.hidden, false);
  assert.match(html, /id="owner-sign-out"[^>]*>Sign out</);
  showOwnerAuthenticationState(elements, "signed-out");
  assert.equal(elements.signedIn.hidden, true);
  assert.equal(elements.account.hidden, true);
});

test("browser-controlled identity hints cannot select authenticated state", function () {
  const local = storage({
    demeosActiveBusinessId: "business-a",
    trustedIdentityId: "invented-user",
    actorScope: "business-owner",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "business-a", name: "Browser Cafe" }])
  });
  const elements = authenticationElements();
  showOwnerAuthenticationState(elements, "signed-out");
  assert.equal(getOwnerWorkspaceContext(local).profile.name, "Browser Cafe", "profile remains presentation context");
  assert.equal(elements.signedIn.hidden, true, "local state does not authenticate the workspace");
  assert.doesNotMatch(script, /location\.(?:search|hash)|URLSearchParams|user\.metadata|publicMetadata|unsafeMetadata/);
});

test("browser authentication source neither handles nor stores Clerk tokens", function () {
  const browserSource = `${html}\n${script}`;
  assert.doesNotMatch(browserSource, /CLERK_SECRET_KEY|sessionStorage|setItem\([^)]*(?:token|jwt)|decode(?:Jwt|Token)|sessionClaims/i);
  assert.match(script, /Clerk's browser SDK manages its session/);
  assert.match(script, /Server-side ownership authorization is authoritative/);
});

test("Clerk session changes alone control workspace visibility and sign-out", async function () {
  const elements = authenticationElements();
  elements.signIn = { addEventListener: function () {} };
  elements.signOut = {
    addEventListener: function (_name, handler) { this.click = handler; }
  };
  const clerk = {
    user: null,
    addListener: function (listener) { this.listener = listener; },
    openSignIn: function () {},
    signOut: function () { this.user = null; return Promise.resolve(); }
  };
  const documentObject = {
    getElementById: function () {
      return { replaceChildren: function () {}, appendChild: function () {}, textContent: "" };
    },
    createElement: function () { return { textContent: "", append: function () {} }; }
  };
  const local = storage({
    demeosActiveBusinessId: "browser-business",
    trustedIdentityId: "browser-identity",
    actorScope: "business-owner",
    demeosBusinessProfiles: JSON.stringify([{ businessId: "browser-business", name: "Browser profile" }])
  });

  bindOwnerClerkSession(clerk, documentObject, local, elements);
  assert.equal(elements.signedIn.hidden, true, "browser state cannot authenticate");
  clerk.user = { publicMetadata: { businessId: "metadata-business" } };
  clerk.listener({ user: clerk.user });
  assert.equal(elements.signedIn.hidden, false, "a Clerk user reveals the workspace");
  await elements.signOut.click();
  assert.equal(elements.signedIn.hidden, true, "sign-out immediately conceals the workspace");
});

test("Clerk browser SDK uses current v6 bundle with Clerk UI support", function () {
  assert.match(script, /@clerk\/ui@1\/dist\/ui\.browser\.js/);
  assert.match(script, /@clerk\/clerk-js@6\/dist\/clerk\.browser\.js/);
  assert.match(script, /ClerkUI: windowObject\.__internal_ClerkUICtor/);
  assert.doesNotMatch(script, /@clerk\/clerk-js@5/);
  assert.doesNotMatch(script, /cdn\.jsdelivr\.net\/npm\/@clerk\/clerk-js/);
});
