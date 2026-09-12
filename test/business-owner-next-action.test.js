const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  getTrustedOwnerNextAction, loadOwnerNextAction
} = require("../js/business-workspace.js");
const html = fs.readFileSync(require.resolve("../business-workspace.html"), "utf8");

function record(campaigns, businessId = "business-a") {
  return { businessProfile: { businessId }, campaigns };
}

function campaign(values = {}) {
  return { businessId: "business-a", ...values };
}

function renderDocument() {
  const container = {
    children: [],
    replaceChildren() { this.children = []; },
    append(...children) { this.children.push(...children); }
  };
  return {
    container,
    getElementById(id) { return id === "workspace-next-action" ? container : null; },
    createElement(tagName) { return { tagName, textContent: "", href: "", className: "" }; }
  };
}

test("Overview contains the owner-facing Next Action card without changing existing cards", function () {
  assert.match(html, /<h3 id="next-action-heading">Next Action<\/h3>/);
  assert.match(html, /id="workspace-next-action"/);
  assert.match(html, /id="selected-business-heading">Business identity<\/h3>/);
  assert.match(html, /id="current-work-heading">Current work<\/h3>/);
  assert.match(html, />Manage Business Profile<\/a>/);
  assert.match(html, />Open Marketing<\/a>/);
});

test("trusted action rules use their exact priority and destinations", function () {
  const unapproved = getTrustedOwnerNextAction(record([
    campaign({ approvalStatus: "Approved" }),
    campaign({ approvalStatus: "Unapproved" })
  ]), "business-a");
  assert.deepEqual([unapproved.title, unapproved.destination],
    ["Review your campaign", "index.html#campaigns"]);

  const missingOutcome = getTrustedOwnerNextAction(record([
    campaign({ approvalStatus: "Approved" })
  ]), "business-a");
  assert.equal(missingOutcome.title, "Record what happened");
  assert.equal(missingOutcome.destination, "index.html#campaigns");

  const notUsed = getTrustedOwnerNextAction(record([
    campaign({ approvalStatus: "Approved", outcome: { outcome: "Not used yet" } })
  ]), "business-a");
  assert.equal(notUsed.title, "Record what happened");

  for (const outcome of ["Positive", "Mixed", "No noticeable result"]) {
    const recommendation = getTrustedOwnerNextAction(record([
      campaign({ approvalStatus: "Approved", outcome: { outcome } })
    ]), "business-a");
    assert.equal(recommendation.title, "Ask DEMEOS what to do next", outcome);
    assert.equal(recommendation.destination, "index.html#recommends", outcome);
  }

  const first = getTrustedOwnerNextAction(record([]), "business-a");
  assert.equal(first.title, "Create your first marketing work");
  assert.equal(first.destination, "index.html#create");
});

test("only matching campaigns from a matching trusted business record are considered", function () {
  const isolated = getTrustedOwnerNextAction(record([
    { businessId: "business-b", approvalStatus: "Unapproved" }
  ]), "business-a");
  assert.equal(isolated.title, "Create your first marketing work");

  const rejected = getTrustedOwnerNextAction(record([], "business-b"), "business-a");
  assert.equal(rejected.title, "Next action unavailable");
});

test("protected server business record determines Next Action instead of browser campaign cache", async function () {
  const documentObject = renderDocument();
  const localCampaignCache = JSON.stringify([
    campaign({ approvalStatus: "Unapproved" })
  ]);
  const storage = {
    getItem(key) {
      if (key === "demeosActiveBusinessId") return "business-a";
      if (key === "demeosCampaignHistory") return localCampaignCache;
      return null;
    }
  };
  let request;
  const action = await loadOwnerNextAction(documentObject, storage, async function (url, options) {
    request = { url, options };
    return { ok: true, async json() { return record([]); } };
  });
  assert.equal(action.title, "Create your first marketing work");
  assert.deepEqual(request, {
    url: "/api/businesses/business-a",
    options: { method: "GET", credentials: "same-origin" }
  });
  assert.equal(documentObject.container.children[2].href, "index.html#create");
});

test("failed protected load stays unavailable and never infers from browser cache", async function () {
  const documentObject = renderDocument();
  const storage = {
    getItem(key) {
      if (key === "demeosActiveBusinessId") return "business-a";
      if (key === "demeosCampaignHistory") return JSON.stringify([
        campaign({ approvalStatus: "Unapproved" })
      ]);
      return null;
    }
  };
  const action = await loadOwnerNextAction(documentObject, storage, async function () {
    return { ok: false, status: 500 };
  });
  assert.deepEqual(action, {
    title: "Next action unavailable",
    explanation: "DEMEOS could not confirm your current marketing state.",
    action: "Open Marketing",
    destination: "index.html"
  });
  assert.equal(documentObject.container.children[0].textContent, "Next action unavailable");
});

test("Next Action links preserve owner control and perform no workflow mutations", function () {
  const card = html.match(/<section class="owner-next-action"[\s\S]*?<\/section>/);
  assert.ok(card);
  assert.doesNotMatch(card[0], /<button|onclick=|form|recommendations-btn|generate-btn/i);
  assert.doesNotMatch(card[0], /POST|PUT|PATCH|DELETE|approve|record.*outcome/i);
});
