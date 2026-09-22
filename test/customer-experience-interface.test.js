const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createCustomerWorkCard, getServerCustomerPackages, getValidCustomerWork,
  getLocalGreeting, getPreferredLanguage, normalizedCustomerIntention, recordParticipation,
  renderCustomerWork, requestCustomerLocation, selectCustomerIntention } = require("../js/customer.js");
const { confirmTrustedCustomer } = require("../js/my-demeos.js");

class Element {
  constructor(tag = "div") { this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; this._text = ""; this.innerHTML = ""; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  set textContent(value) { this._text = value; if (!value) this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
}

function fakeDocument() {
  const elements = { "customer-work-status": new Element(), "customer-work-list": new Element() };
  return { elements, createElement(tag) { return new Element(tag); }, getElementById(id) { return elements[id]; } };
}

test("customer journey renders approved public content without internal controls or invented facts", function () {
  const document = fakeDocument();
  const work = { workItemId: "approved-a", businessName: "North Star",
    location: "Leeds", content: "The exact approved customer message.", participationAction: "Interested",
    campaignStrategy: "private strategy", emailCampaign: "private email", ownerRecommendation: "private" };
  renderCustomerWork(document, [work], [], async function () {});
  const output = document.elements["customer-work-list"].textContent;
  assert.match(output, /North Star|Leeds|The exact approved customer message|Interested/);
  assert.doesNotMatch(output, /private strategy|private email|ownerRecommendation|approval control|customer count|rating|price|discount|opening hours/i);
});

test("participation sends only the action and no browser-provided business identity", async function () {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async function (url, options) { request = { url, options }; return { ok: true }; };
  try { await recordParticipation({ workItemId: "work/a", participationAction: "Interested" }); }
  finally { global.fetch = originalFetch; }
  assert.equal(request.url, "/api/customer/work/work%2Fa/participation");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), { action: "Interested" });
});

test("malformed public work is skipped without hiding valid work or exposing object values", function () {
  const document = fakeDocument();
  const valid = { workItemId: " valid-a ", businessName: " North Star ", location: " Leeds ",
    content: " Approved message ", participationAction: "Interested" };
  const malformed = [
    { ...valid, workItemId: undefined },
    { ...valid, businessName: null },
    { ...valid, content: "" },
    { ...valid, workItemId: "   " },
    { ...valid, participationAction: "Buy" },
    { ...valid, businessName: { name: "Object Business" } },
    { ...valid, content: ["Array content"] }
  ];

  renderCustomerWork(document, [valid, ...malformed], [], async function () {});

  const cards = document.elements["customer-work-list"].children;
  assert.equal(cards.length, 1);
  assert.match(cards[0].textContent, /North Star|Leeds|Approved message|Interested/);
  assert.doesNotMatch(cards[0].textContent, /undefined|null|\[object Object\]|Buy|Array content/);
});

test("empty locations are omitted and malformed package data cannot become visible", function () {
  const work = { workItemId: "a", businessName: "North Star", location: "   ",
    content: "Approved message", participationAction: "Interested" };
  assert.deepEqual(getValidCustomerWork([work]), [{ workItemId: "a", businessName: "North Star",
    content: "Approved message", participationAction: "Interested" }]);

  const document = fakeDocument();
  renderCustomerWork(document, [work], { name: "Gold", price: "£99", benefits: ["Reward"] }, async function () {});
  assert.doesNotMatch(document.elements["customer-work-list"].textContent, /Gold|£99|Reward/);
});

test("malformed work cannot send participation and valid participation is always Interested", async function () {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async function (url, options) { requests.push({ url, options }); return { ok: true }; };
  try {
    await assert.rejects(recordParticipation({ workItemId: "a", participationAction: "Pay" }));
    await assert.rejects(recordParticipation({ workItemId: "", participationAction: "Interested" }));
    await recordParticipation({ workItemId: " a ", businessName: "Business", content: "Content",
      participationAction: "Interested", action: "Pay" });
  } finally { global.fetch = originalFetch; }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/customer/work/a/participation");
  assert.deepEqual(JSON.parse(requests[0].options.body), { action: "Interested" });
});

test("Discover does not record personal interest before an issued possibility exists", function () {
  const document = fakeDocument();
  let participationCalls = 0;
  const card = createCustomerWorkCard(document, { workItemId: "a", businessName: "North Star",
    location: "Leeds", content: "Approved message", participationAction: "Interested" }, [], async function () {
    participationCalls += 1;
  });
  const action = card.children[3].children[1];
  assert.equal(action.tag, "a");
  assert.equal(action.href, "#intention");
  assert.equal(participationCalls, 0);
  assert.match(card.textContent, /matched an approved possibility/i);
});

test("Discover renders approved media as viewing content without inventing continuation", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "a", businessName: "North Star", content: "Approved message",
    participationAction: "Interested",
    media: [
      { assetId: "image-a", kind: "image", role: "primary", deliveryUrl: "https://cdn.example.com/a.webp", contentType: "image/webp" },
      { assetId: "video-a", kind: "video", role: "supporting", deliveryUrl: "https://cdn.example.com/a.mp4", contentType: "video/mp4" }
    ]
  }, [], async function () {});

  const mediaRegion = card.children[1].children[2];
  assert.equal(mediaRegion.children.length, 2);
  assert.equal(mediaRegion.children[0].tag, "img");
  assert.equal(mediaRegion.children[0].src, "https://cdn.example.com/a.webp");
  assert.equal(mediaRegion.children[1].tag, "video");
  assert.equal(mediaRegion.children[1].src, "https://cdn.example.com/a.mp4");
  assert.equal(mediaRegion.children[1].controls, true);
  assert.equal(mediaRegion.children[1].playsInline, true);
  assert.doesNotMatch(card.textContent, /buy now|checkout|purchase now/i);
});

test("empty approved feed has a professional empty state", function () {
  const document = fakeDocument();
  renderCustomerWork(document, [], [], async function () {});
  assert.match(document.elements["customer-work-status"].innerHTML, /Nothing to discover just yet/);
  assert.equal(document.elements["customer-work-list"].children.length, 0);
});

test("journey anchors target the first work item without duplicate ids", function () {
  const document = fakeDocument();
  const work = ["a", "b"].map(function (id) {
    return { workItemId: id, businessName: `Business ${id}`,
      content: `Approved ${id}`, participationAction: "Interested" };
  });
  renderCustomerWork(document, work, [], async function () {});
  const first = document.elements["customer-work-list"].children[0];
  const second = document.elements["customer-work-list"].children[1];
  assert.equal(first.children[0].id, "understand");
  assert.equal(first.children[2].id, "choose");
  assert.equal(first.children[3].id, "participate");
  assert.equal(second.children[0].id, undefined);
  assert.equal(second.children[2].id, undefined);
  assert.equal(second.children[3].id, undefined);
});

test("package-ready choice uses only the server contract and invents no package claims", function () {
  const document = fakeDocument();
  const work = { workItemId: "a", businessName: "North Star",
    content: "Approved message", participationAction: "Interested" };
  renderCustomerWork(document, [work], getServerCustomerPackages({ customerPackages: [] }), async function () {});

  const output = document.elements["customer-work-list"].textContent;
  assert.match(output, /03 · Choose|Customer options will appear here when available\./);
  assert.doesNotMatch(output, /£|\$|price|discount|membership|member|benefit|reward|subscription|commission|eligible/i);
  assert.deepEqual(getServerCustomerPackages({ customerPackages: "from-localStorage" }), []);
});

test("participation remains Interested and is expressly not a commercial outcome", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, { workItemId: "a", businessName: "North Star",
    content: "Approved message", participationAction: "Interested" }, [], async function () {});

  assert.match(card.textContent, /Your choice|Interested in something you see/i);
  assert.match(card.textContent, /Personal interest is recorded only after DEMEOS has matched an approved possibility/i);
  assert.doesNotMatch(card.textContent, /interest shared|participation signal has been shared|buy now|checkout|converted|subscribe now|package accepted/i);
});

test("page presents Stage 1 before approved work and no owner interface", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  assert.match(html, /images\/demeos-logo\.png/);
  assert.ok(html.indexOf('id="discover"') < html.indexOf('id="intention"'));
  assert.match(html, /customer-intention-options|customer-intention-text|customer-location-button/);
  assert.doesNotMatch(html, /business profile|recommendation|campaign strategy|email strategy|approval controls|capability registry|dashboard|ratings|prices|discounts|opening hours/i);
});

test("Customer Interface retains responsive layouts for intentions and participation", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/style.css"), "utf8");
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-intention-options[\s\S]*?grid-template-columns: repeat\(2, 1fr\)/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-participation[\s\S]*?flex-direction: column/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-participation-button \{ width: 100%; \}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("My DEMEOS trusts only the server-confirmed customer identity", async function () {
  let requests = 0;
  const authenticated = await confirmTrustedCustomer(async function (url, options) {
    requests += 1;
    assert.equal(url, "/api/customer/identity");
    assert.equal(options.credentials, "same-origin");
    return { ok: true, async json() { return { authenticated: true }; } };
  });
  assert.equal(requests, 1);
  assert.equal(authenticated, true);

  assert.equal(await confirmTrustedCustomer(async function () {
    return { ok: true, async json() { return { authenticated: false }; } };
  }), false);
  assert.equal(await confirmTrustedCustomer(async function () {
    return { ok: false };
  }), false);
});

test("My DEMEOS keeps private relationship areas behind sign-in language", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "my-demeos.html"), "utf8");
  assert.match(html, /Sign in to My DEMEOS to keep and see your intentions across visits/);
  assert.match(html, /Sign in to My DEMEOS to keep and see your possibilities across visits/);
  assert.match(html, /Sign in to My DEMEOS to see your participation across visits/);
  assert.match(html, /Sign in to My DEMEOS to add and manage your preferences/);
  assert.match(html, /id="privacy-control-signed-out"/);
  assert.match(html, /id="privacy-controls-form"[^>]*hidden/);
});

test("local greeting follows morning, afternoon and evening boundaries", function () {
  assert.equal(getLocalGreeting(5), "Good morning");
  assert.equal(getLocalGreeting(new Date(2026, 0, 1, 11, 59)), "Good morning");
  assert.equal(getLocalGreeting(12), "Good afternoon");
  assert.equal(getLocalGreeting(17), "Good afternoon");
  assert.equal(getLocalGreeting(18), "Good evening");
  assert.equal(getLocalGreeting(4), "Good evening");
});

test("intention free text is normalized without becoming participation", function () {
  assert.equal(normalizedCustomerIntention("  spend   time\n together  "), "spend time together");
  assert.equal(normalizedCustomerIntention(null), "");
});

test("intention selection accepts only the six Stage 1 controls", function () {
  assert.equal(selectCustomerIntention("Eat & enjoy"), "Eat & enjoy");
  assert.equal(selectCustomerIntention("Discover something new"), "Discover something new");
  assert.equal(selectCustomerIntention("Book now"), "");
});

test("preferred language uses browser preference and falls back to English", function () {
  assert.equal(getPreferredLanguage({ languages: ["cy-GB", "en-GB"], language: "en-GB" }), "cy-GB");
  assert.equal(getPreferredLanguage({ languages: [], language: "fr" }), "fr");
  assert.equal(getPreferredLanguage({}), "en");
});

test("location is requested only by an explicit helper call and denial remains optional", function () {
  let requests = 0;
  const states = [];
  const geolocation = { getCurrentPosition(success, denied) { requests += 1; denied(); } };
  assert.equal(requests, 0);
  requestCustomerLocation(geolocation, (state) => states.push(state));
  assert.equal(requests, 1);
  assert.deepEqual(states, ["optional"]);
});

test("available location exposes only neutral session state", function () {
  const states = [];
  requestCustomerLocation({ getCurrentPosition(success) { success({ coords: { latitude: 1, longitude: 2 } }); } },
    (state) => states.push(state));
  assert.deepEqual(states, ["available"]);
});
