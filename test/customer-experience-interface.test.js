const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createCustomerWorkCard, getServerCustomerPackages, getValidCustomerWork,
  getLocalGreeting, getPreferredLanguage, normalizedCustomerIntention, recordParticipation,
  renderCustomerWork, requestCustomerLocation, selectCustomerIntention, applyCustomerSurfaceRoute, getDiscoverRequest, loadCustomerWork, toCustomerWorkItem } = require("../js/customer.js");
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


test("Discover public contract gives different businesses a first distribution pass", function () {
  const { getValidPublicCustomerWork } = require("../api/_lib/customer-public-work-contract.js");
  const work = [
    { workItemId: "a1", businessId: "a", businessName: "Business A", content: "A first", participationAction: "Interested" },
    { workItemId: "a2", businessId: "a", businessName: "Business A", content: "A second", participationAction: "Interested" },
    { workItemId: "b1", businessId: "b", businessName: "Business B", content: "B first", participationAction: "Interested" }
  ];
  assert.deepEqual(getValidPublicCustomerWork(work, 3).map(function (item) { return item.workItemId; }), ["a1", "b1", "a2"]);
  assert.deepEqual(getValidPublicCustomerWork(work, 2).map(function (item) { return item.workItemId; }), ["a1", "b1"]);
});

test("Discover fails safely when approved work cannot be loaded", async function () {
  const document = fakeDocument();
  await loadCustomerWork(document, async function () {
    return { ok: false, async json() { return { error: "Unavailable" }; } };
  });
  const status = document.elements["customer-work-status"];
  assert.equal(status.className, "customer-empty-state customer-load-error");
  assert.equal(status.textContent, "DEMEOS could not load Discover right now. Try again");
  assert.equal(document.elements["customer-work-list"].children.length, 0);
});

test("Discover fails safely when the server response is malformed", async function () {
  const document = fakeDocument();
  await loadCustomerWork(document, async function () {
    return { ok: true, async json() { return { work: { private: "not a public list" } }; } };
  });
  assert.match(document.elements["customer-work-status"].textContent, /could not load Discover/i);
  assert.equal(document.elements["customer-work-list"].children.length, 0);
});

test("Discover distributed work is vertically navigable in customer order", function () {
  const document = fakeDocument();
  const work = ["a", "b"].map(function (id) {
    return { workItemId: id, businessName: "Business " + id.toUpperCase(), content: "Approved " + id, participationAction: "Interested" };
  });
  renderCustomerWork(document, work, [], async function () {});
  const cards = document.elements["customer-work-list"].children;
  assert.equal(cards[0].attributes["data-discover-position"], "1");
  assert.equal(cards[1].attributes["data-discover-position"], "2");
  assert.equal(cards[0].attributes.tabindex, "0");
  assert.match(cards[0].attributes["aria-label"], /Discover item 1 of 2/);
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /\.customer-work-list\{display:grid;gap:1\.25rem;scroll-snap-type:y proximity\}/);
  assert.match(css, /\.customer-work-card\{scroll-snap-align:start;scroll-margin-top:110px\}/);
});

test("Discover keeps business media and options in horizontal navigation lanes", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "work-1", businessName: "Business A", content: "Approved content", participationAction: "Interested",
    media: [{ assetId: "image-1", kind: "image", role: "primary", deliveryUrl: "https://example.com/image.jpg" }],
    customerContinuation: { routes: ["website"], website: "https://example.com" },
    products: [{ productId: "p1", name: "Product", description: "Description", continuationRoute: "website", availability: "available" }]
  }, [], async function () {});
  const media = card.children[1].children.find(function (child) { return child.className === "customer-work-media"; });
  const options = card.children[2].children.find(function (child) { return child.className === "customer-package-region"; });
  assert.equal(media.attributes.role, "list");
  assert.match(media.attributes["aria-label"], /Media from Business A/);
  assert.equal(options.attributes.role, "list");
  assert.match(options.attributes["aria-label"], /Products and services from Business A/);
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /overscroll-behavior-inline:contain/);
});

test("Discover keeps quiet business position context while navigating", function () {
  const document = fakeDocument();
  const work = ["a", "b"].map(function (id) {
    return { workItemId: id, businessName: "Business " + id.toUpperCase(), content: "Approved " + id, participationAction: "Interested" };
  });
  renderCustomerWork(document, work, [], async function () {});
  const firstCard = document.elements["customer-work-list"].children[0];
  const position = firstCard.children[0].children.find(function (child) { return child.className === "customer-discover-position"; });
  assert.equal(position.textContent, "1 / 2");
  assert.equal(position.attributes["aria-hidden"], "true");
  assert.match(firstCard.attributes["aria-label"], /Business A — Discover item 1 of 2/);
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /\.customer-work-context\{position:sticky;top:0/);
});

test("Discover campaign media remains view-only until a validated item continuation exists", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "work-media-boundary", businessName: "Business A", content: "Approved content", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://business.example" },
    media: [
      { assetId: "media-1", kind: "image", role: "primary", deliveryUrl: "https://cdn.example/media.jpg" },
      { assetId: "media-2", kind: "video", role: "supporting", deliveryUrl: "https://cdn.example/media.mp4" }
    ]
  }, [], async function () {});
  const message = card.children[1];
  const mediaRegion = message.children.find(function (child) { return child.className === "customer-work-media"; });
  assert.ok(mediaRegion);
  assert.equal(mediaRegion.children.length, 2);
  assert.equal(mediaRegion.children[0].tag, "img");
  assert.equal(mediaRegion.children[0].href, undefined);
  assert.equal(mediaRegion.children[0].children.length, 0);
  assert.equal(mediaRegion.children[1].tag, "video");
  assert.equal(mediaRegion.children[1].href, undefined);
  assert.equal(mediaRegion.children[1].children.length, 0);
});

test("Discover media matches only its exact validated related product", function () {
  const document = fakeDocument();
  const work = toCustomerWorkItem({
    workItemId: "work-product-media", businessName: "Business A", content: "Approved content", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://business.example" },
    products: [
      { productId: "product-1", name: "One", description: "First", continuationRoute: "website" },
      { productId: "product-2", name: "Two", description: "Second", continuationRoute: "website" }
    ],
    media: [
      { assetId: "media-1", kind: "image", role: "primary", deliveryUrl: "https://cdn.example/one.jpg", purpose: "product", relatedEntityId: "product-1" },
      { assetId: "video-1", kind: "video", role: "supporting", deliveryUrl: "https://cdn.example/one.mp4", purpose: "product", relatedEntityId: "product-1" },
      { assetId: "media-2", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example/unknown.jpg", purpose: "product", relatedEntityId: "product-9" }
    ]
  });
  assert.equal(work.media[0].purpose, "product");
  assert.equal(work.media[0].relatedEntityId, "product-1");
  const card = createCustomerWorkCard(document, work, [], async function () {});
  const mediaRegion = card.children[1].children.find(function (child) { return child.className === "customer-work-media"; });
  assert.equal(mediaRegion.children[0].tag, "a");
  assert.equal(mediaRegion.children[0].children[0].attributes["data-related-product-id"], "product-1");
  assert.equal(mediaRegion.children[1].tag, "video");
  assert.equal(mediaRegion.children[1].attributes["data-related-product-id"], "product-1");
  assert.equal(mediaRegion.children[2].attributes["data-related-product-id"], undefined);
  assert.equal(mediaRegion.children[0].href, "https://business.example");
  assert.equal(mediaRegion.children[1].href, undefined);
  assert.equal(mediaRegion.children[2].href, undefined);
});

test("Discover makes only exactly matched available media actionable", function () {
  const document = fakeDocument();
  const work = toCustomerWorkItem({
    workItemId: "work-actionable-media", businessName: "Business A", content: "Approved content", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://business.example/product" },
    products: [
      { productId: "product-1", name: "One", description: "First", continuationRoute: "website", availability: "available" },
      { productId: "product-2", name: "Two", description: "Second", continuationRoute: "website", availability: "unavailable" }
    ],
    media: [
      { assetId: "media-1", kind: "image", role: "primary", deliveryUrl: "https://cdn.example/one.jpg", purpose: "product", relatedEntityId: "product-1" },
      { assetId: "media-2", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example/two.jpg", purpose: "product", relatedEntityId: "product-2" },
      { assetId: "media-3", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example/unknown.jpg", purpose: "product", relatedEntityId: "product-9" }
    ]
  });
  const card = createCustomerWorkCard(document, work, [], async function () {});
  const mediaRegion = card.children[1].children.find(function (child) { return child.className === "customer-work-media"; });
  assert.equal(mediaRegion.children[0].tag, "a");
  assert.equal(mediaRegion.children[0].href, "https://business.example/product");
  assert.equal(mediaRegion.children[0].children[0].attributes["data-related-product-id"], "product-1");
  assert.equal(mediaRegion.children[1].tag, "img");
  assert.equal(mediaRegion.children[2].tag, "img");
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

test("Customer Experience keeps Discover, products and My DEMEOS responsive", function () {
  const customerCss = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  const productCss = fs.readFileSync(path.join(__dirname, "..", "css/customer-product-gallery.css"), "utf8");
  const myDemeosCss = fs.readFileSync(path.join(__dirname, "..", "css/my-demeos-simple.css"), "utf8");

  assert.match(customerCss, /@media\(max-width:680px\)[^{]*\{\.customer-work-media\{grid-template-columns:1fr\}/);
  assert.match(customerCss, /@media\(max-width:680px\)[^{]*\{\.customer-discover-option\{padding:\.9rem\}[\s\S]*?customer-product-continue-action\{width:100%/);
  assert.match(productCss, /@media\(max-width:700px\)[^{]*\{[\s\S]*?\.customer-product-grid\{display:flex[\s\S]*?overflow-x:auto/);
  assert.match(myDemeosCss, /@media\(max-width:760px\)[^{]*\{[\s\S]*?\.my-demeos-areas\{grid-template-columns:1fr\}/);
  assert.match(myDemeosCss, /@media\(max-width:760px\)[^{]*\{[\s\S]*?\.my-demeos-sign-in-status \.demeos-primary-button\{width:100%;min-width:0\}/);
});

test("Customer surface routing keeps Discover public and separates intention", function () {
  const document = fakeDocument();
  const discover = document.elements.discover = new Element("section");
  const intention = document.elements.intention = new Element("section");
  const discoverLink = new Element("a"); discoverLink.classList = { toggle() {} }; discoverLink.removeAttribute = function (name) { delete this.attributes[name]; }; discoverLink.getAttribute = function (name) { return this.attributes[name]; }; discoverLink.setAttribute("href", "#discover");
  const intentionLink = new Element("a"); intentionLink.classList = { toggle() {} }; intentionLink.removeAttribute = function (name) { delete this.attributes[name]; }; intentionLink.getAttribute = function (name) { return this.attributes[name]; }; intentionLink.setAttribute("href", "#intention");
  document.querySelectorAll = function (selector) {
    return selector === ".customer-journey-nav a[href^='#']" ? [discoverLink, intentionLink] : [];
  };

  applyCustomerSurfaceRoute(document, "#discover");
  assert.equal(discover.hidden, false);
  assert.equal(intention.hidden, true);
  assert.equal(discoverLink.attributes["aria-current"], "page");
  assert.equal(intentionLink.attributes["aria-current"], undefined);

  applyCustomerSurfaceRoute(document, "#intention");
  assert.equal(discover.hidden, true);
  assert.equal(intention.hidden, false);
  assert.equal(discoverLink.attributes["aria-current"], undefined);
  assert.equal(intentionLink.attributes["aria-current"], "page");

  applyCustomerSurfaceRoute(document, "#customer-intention-form");
  assert.equal(discover.hidden, true);
  assert.equal(intention.hidden, false);
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


test("Discover populated surface is organised as a responsive business experience", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /Discover populated surface — one organised business experience per vertical step/);
  assert.match(css, /\.customer-work-card\{min-height:min\(760px,calc\(100vh - 130px\)\)/);
  assert.match(css, /\.customer-work-context\{top:92px;display:flex;align-items:center/);
  assert.match(css, /\.customer-work-card \.customer-work-media-item,\.customer-work-card \.customer-work-media-link\{flex-basis:min\(82%,720px\)\}/);
  assert.match(css, /\.customer-work-card \.customer-discover-option\{flex-basis:min\(68%,430px\);min-width:280px\}/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.customer-work-card \.customer-discover-option\{flex-basis:88%;min-width:240px\}/);
});


test("Discover controlled preview is explicit and normal requests stay unchanged", function () {
  assert.deepEqual(getDiscoverRequest({ search: "" }), { url: "/api/customer/work", options: undefined, testMode: false });
  assert.deepEqual(getDiscoverRequest({ search: "?demeos-test=1" }), {
    url: "/api/customer/work?demeos-test=1",
    options: { headers: { "x-demeos-discover-test": "controlled-preview" } },
    testMode: true
  });
  assert.equal(getDiscoverRequest({ search: "?demeos-test=0" }).testMode, false);
});

test("Discover controlled preview visibly identifies populated test content", async function () {
  const document = fakeDocument();
  await loadCustomerWork(document, async function (url, options) {
    assert.equal(url, "/api/customer/work?demeos-test=1");
    assert.equal(options.headers["x-demeos-discover-test"], "controlled-preview");
    return { ok: true, async json() { return { testMode: true, work: [
      { workItemId: "test-a", businessName: "DEMEOS Test Bistro", content: "Controlled preview content", participationAction: "Interested" }
    ] }; } };
  }, { search: "?demeos-test=1" });
  assert.match(document.elements["customer-work-status"].textContent, /CONTROLLED TEST CONTENT/);
  assert.match(document.elements["customer-work-list"].textContent, /DEMEOS Test Bistro/);
});


test("Discover mobile surface stays inside the viewport while horizontal lanes remain self-contained", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /Discover mobile viewport containment — keep the business surface inside the phone while lanes scroll internally/);
  assert.match(css, /\.customer-main\{overflow-x:hidden\}/);
  assert.match(css, /\.customer-work-card\{width:100%;min-width:0;overflow:hidden\}/);
  assert.match(css, /\.customer-work-card \.customer-work-media,\.customer-work-card \.customer-package-region\{width:100%;max-width:100%;min-width:0;box-sizing:border-box\}/);
  assert.match(css, /\.customer-work-card \.customer-discover-option\{flex-basis:calc\(100% - 1rem\);max-width:calc\(100% - 1rem\);min-width:0;box-sizing:border-box\}/);
});


test("Discover presents each business as one coherent responsive customer surface", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /Discover premium customer surface — present each business as one coherent experience, not stacked system panels/);
  assert.match(css, /\.customer-work-card\{overflow:hidden;background:linear-gradient/);
  assert.match(css, /\.customer-work-card \.customer-choice\{margin:0 1\.4rem;padding:1\.15rem 0 1\.35rem;border-top/);
  assert.match(css, /\.customer-work-card \.customer-participation\{margin:0 1\.4rem;padding:1\.25rem 0 1\.5rem;background:transparent\}/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.customer-work-context\{top:72px;display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css, /\.customer-work-card \.customer-discover-option\{flex-basis:calc\(100% - 2rem\);max-width:calc\(100% - 2rem\);padding:1rem\}/);
});


test("Discover mobile is content first instead of stacked development panels", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /Discover immersive mobile — content first, compact controls, no development-panel presentation/);
  assert.match(css, /\.customer-work-card\{border:0;border-radius:0;box-shadow:none;background:#041226\}/);
  assert.match(css, /\.customer-work-context\{position:relative;top:auto;z-index:1/);
  assert.match(css, /\.customer-message-label\{display:none\}/);
  assert.match(css, /\.customer-work-card \.customer-choice>\.customer-step\{display:none\}/);
  assert.match(css, /\.customer-work-card \.customer-discover-option\{flex-basis:82%;max-width:82%;min-width:0/);
  assert.match(css, /\.customer-participation \.customer-step\{display:none\}/);
});


test("Discover mobile follows the approved image-first reference layout", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/demeos-customer-space.css"), "utf8");
  assert.match(css, /Discover approved reference layout — image first, compact business identity, options and action kept close/);
  assert.match(css, /\.customer-work-card\{display:flex;flex-direction:column/);
  assert.match(css, /\.customer-work-card \.customer-message\{order:1;display:flex;flex-direction:column/);
  assert.match(css, /\.customer-work-card \.customer-work-media\{order:1/);
  assert.match(css, /\.customer-work-context\{order:2/);
  assert.match(css, /\.customer-work-card \.customer-choice\{order:3/);
  assert.match(css, /\.customer-work-card \.customer-participation\{order:4/);
  assert.match(css, /grid-template-columns:92px minmax\(0,1fr\)/);
});
