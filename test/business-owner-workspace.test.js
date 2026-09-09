const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  getOwnerWorkspaceContext, showOwnerAuthenticationState
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
  assert.match(script, /Clerk's browser SDK manages its same-origin session/);
  assert.match(script, /Server-side ownership authorization is authoritative/);
});
