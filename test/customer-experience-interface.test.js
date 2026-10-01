const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createCustomerWorkCard, getServerCustomerPackages, getValidCustomerWork,
  getLocalGreeting, getPreferredLanguage, normalizedCustomerIntention, recordParticipation,
  renderCustomerWork, requestCustomerPossibilities, requestCustomerLocation, selectCustomerIntention, applyCustomerSurfaceRoute, getDiscoverRequest, loadCustomerWork, toCustomerWorkItem } = require("../js/customer.js");
const { confirmTrustedCustomer } = require("../js/my-demeos.js");

test("Tablet Discover presents business media before description without reserved height", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const tablet = css.slice(css.lastIndexOf("/* The actual Discover business card keeps one media-first reading order"));
  assert.match(tablet, /@media\(min-width:681px\) and \(max-width:1180px\)/);
  assert.match(tablet, /customer-work-media\{order:1/);
  assert.match(tablet, /customer-work-content\{order:4/);
  assert.match(tablet, /height:auto;min-height:0/);
});

test("Discover business card keeps identity, media, options and action in one ordered surface", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const unified = css.slice(css.lastIndexOf("/* One cohesive Discover business experience"));
  assert.match(unified, /customer-work-context\{order:1/);
  assert.match(unified, /customer-message\{order:2/);
  assert.match(unified, /customer-choice\{order:3/);
  assert.match(unified, /customer-participation\{order:4/);
  assert.match(unified, /@media\(max-width:680px\)/);
});

test("Discover gallery counter and arrows share one row before the business description", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const gallery = css.slice(css.lastIndexOf("/* Gallery position and arrows share one compact row"));
  assert.match(gallery, /customer-message\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(gallery, /customer-work-media\{grid-column:1 \/ -1/);
  assert.match(gallery, /customer-media-position\{grid-column:1/);
  assert.match(gallery, /customer-media-controls\{grid-column:2/);
  assert.match(gallery, /customer-work-content\{grid-column:1 \/ -1/);
});

test("phone Discover options keep square photography beside details and fit no-image products", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const options = css.slice(css.lastIndexOf("/* Phone product options keep a square image"));
  assert.match(options, /@media\(max-width:680px\)/);
  assert.match(options, /customer-package-region\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(options, /customer-discover-option\{display:grid;grid-template-columns:104px minmax\(0,1fr\)/);
  assert.match(options, /customer-discover-option-image\{display:block;width:104px;height:104px;aspect-ratio:1 \/ 1;object-fit:cover/);
  assert.match(options, /customer-discover-option:not\(\.has-image\)\{grid-template-columns:minmax\(0,1fr\)/);
});

test("tablet Discover options form columns only when cards can keep square images beside readable details", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const options = css.slice(css.lastIndexOf("/* Tablet options use square images"));
  assert.match(options, /@media\(min-width:681px\) and \(max-width:1180px\)/);
  assert.match(options, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,390px\),1fr\)\)/);
  assert.match(options, /customer-discover-option\{display:grid;grid-template-columns:144px minmax\(0,1fr\)/);
  assert.match(options, /customer-discover-option-image\{display:block;width:144px;height:144px;aspect-ratio:1 \/ 1;object-fit:cover/);
  assert.match(options, /customer-discover-option:not\(\.has-image\)\{grid-template-columns:minmax\(0,1fr\)/);
});

test("Discover hides the redundant native gallery bar while retaining horizontal scroll and snap", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const gallery = css.slice(css.lastIndexOf("/* The live media counter and arrows"));
  assert.match(gallery, /customer-work-media\{overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none\}/);
  assert.match(gallery, /customer-work-media::-webkit-scrollbar\{display:none\}/);
});

test("Discover card clipping leaves its business identity sticky without a reserved top band", function () {
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  const card = css.slice(css.lastIndexOf("/* Clip the rounded card"));
  assert.match(card, /customer-work-card\{overflow:clip\}/);
  const identity = fs.readFileSync(path.join(__dirname, "../css/demeos-customer-space.css"), "utf8");
  assert.match(identity, /\.customer-work-context\{position:sticky;top:0/);
});

test("Discover has a visible three-part customer journey on the actual customer page", function () {
  const html = fs.readFileSync(path.join(__dirname, "../customer.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../css/customer-mobile-refinement.css"), "utf8");
  assert.match(html, /customer-discover-entry-guide/);
  assert.match(html, /Explore business images, products and services/);
  assert.match(html, /Describe what you want for relevant possibilities/);
  assert.match(html, /Keep your confirmed interests in your private space/);
  assert.match(css, /customer-discover-entry-guide/);
  assert.match(css, /@media\(max-width:680px\)/);
});

class Element {
  constructor(tag = "div") { this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; this._text = ""; this.innerHTML = ""; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
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
  assert.equal(mediaRegion.children[0].tag, "a");
  assert.equal(mediaRegion.children[0].href, "https://cdn.example.com/a.webp");
  assert.equal(mediaRegion.children[0].children[0].src, "https://cdn.example.com/a.webp");
  assert.equal(mediaRegion.children[1].tag, "video");
  assert.equal(mediaRegion.children[1].src, "https://cdn.example.com/a.mp4");
  assert.equal(mediaRegion.children[1].controls, true);
  assert.equal(mediaRegion.children[1].playsInline, true);
  assert.doesNotMatch(card.textContent, /buy now|checkout|purchase now/i);
});


test("Discover ignores unverified commission and checkout claims from public work", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "commission-claim", businessName: "Example Vendor", content: "Approved product",
    participationAction: "Interested",
    commercialMode: "commission", commissionRate: 7, paymentReady: true,
    checkoutUrl: "https://unverified.example/checkout",
    customerContinuation: { website: "https://business.example/approved" },
    products: [{
      productId: "product-1", name: "Approved product", description: "Product information",
      continuationRoute: "website", availability: "available", price: "£100",
      paymentReady: true, checkoutUrl: "https://unverified.example/checkout"
    }]
  }, [], async function () {});
  const option = card.children.find(function (child) { return child.className === "customer-choice"; });
  assert.ok(option);
  assert.doesNotMatch(card.textContent, /buy now|checkout|pay with demeos/i);
  const links = [];
  function collect(node) {
    if (node.tag === "a") links.push(node.href);
    (node.children || []).forEach(collect);
  }
  collect(option);
  assert.ok(links.includes("https://business.example/approved"));
  assert.ok(!links.includes("https://unverified.example/checkout"));
});

test("public Discover serialization excludes payment authority and private checkout data", function () {
  const { getValidPublicCustomerWork } = require("../api/_lib/customer-public-work-contract.js");
  const [publicItem] = getValidPublicCustomerWork([{
    workItemId: "a", businessId: "vendor-a", businessName: "Example Vendor",
    content: "Approved message", participationAction: "Interested",
    commercialArrangement: "commission", paymentReady: true,
    providerAccountId: "private-account", checkoutUrl: "https://unverified.example/pay",
    customerContinuation: { routes: ["website"], website: "https://business.example/approved" },
    products: [{
      businessId: "vendor-a", productId: "p1", name: "Product", description: "Approved description",
      continuationRoute: "website", availability: "available", price: "£100",
      commercialArrangement: "commission", paymentReady: true,
      providerAccountId: "private-account", checkoutUrl: "https://unverified.example/pay"
    }]
  }]);
  assert.ok(publicItem);
  assert.equal(publicItem.customerContinuation.website, "https://business.example/approved");
  assert.equal(publicItem.products[0].name, "Product");
  const serialized = JSON.stringify(publicItem);
  assert.doesNotMatch(serialized, /commercialArrangement|paymentReady|providerAccountId|checkoutUrl|unverified\\.example|private-account/);
});

test("Discover retains product information and approved route when its image fails", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "image-failure", businessName: "Example Business", content: "Approved content",
    participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://business.example/approved" },
    products: [{ productId: "p1", name: "Product", description: "Approved details",
      continuationRoute: "website", availability: "available", imageUrl: "https://business.example/broken.webp" }]
  }, [], async function () {});
  const choice = card.children.find(function (child) { return child.className === "customer-choice"; });
  const option = choice.children[2].children[0];
  const imageLink = option.children[0];
  imageLink.children[0].listeners.error();
  assert.match(option.textContent, /Image unavailable/);
  assert.match(option.textContent, /Product|Approved details/);
  assert.equal(imageLink.href, "https://business.example/approved");
});

test("Discover uses contact wording when availability is limited or unconfirmed", function () {
  for (const availability of ["limited", "contact"]) {
    const document = fakeDocument();
    const card = createCustomerWorkCard(document, {
      workItemId: "availability-" + availability, businessName: "Example Business", content: "Approved content",
      participationAction: "Interested",
      customerContinuation: { routes: ["website"], website: "https://business.example/approved" },
      products: [{ productId: "p1", name: "Product", description: "Details",
        continuationRoute: "website", availability, imageUrl: "https://business.example/product.webp" }]
    }, [], async function () {});
    const choice = card.children.find(function (child) { return child.className === "customer-choice"; });
    const imageLink = choice.children[2].children[0].children[0];
    assert.equal(imageLink.attributes["aria-label"], "Product — contact Example Business");
    assert.match(choice.textContent, /Contact Example Business/);
    assert.doesNotMatch(choice.textContent, /Continue with Example Business/);
  }
});

test("Discover clearly marks unavailable products without continuation", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "availability-test", businessName: "Example Business", content: "Approved content",
    participationAction: "Interested",
    customerContinuation: { website: "https://business.example/approved" },
    products: [{ productId: "p1", name: "Unavailable item", description: "Details",
      continuationRoute: "website", availability: "unavailable", price: "£22" }]
  }, [], async function () {});
  const choice = card.children.find(function (child) { return child.className === "customer-choice"; });
  assert.match(choice.textContent, /Currently unavailable/);
  const links = [];
  function collect(node) { if (node.tag === "a") links.push(node.href); (node.children || []).forEach(collect); }
  collect(choice);
  assert.ok(!links.includes("https://business.example/approved"));
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

test("Discover business controls move to adjacent approved businesses and stop at the ends", function () {
  const document = fakeDocument();
  const work = ["a", "b", "c"].map(function (id) {
    return { workItemId: id, businessName: "Business " + id.toUpperCase(), content: "Approved " + id, participationAction: "Interested" };
  });
  renderCustomerWork(document, work, [], async function () {});
  const cards = document.elements["customer-work-list"].children;
  const controls = cards.map(function (card) {
    return card.children[0].children.find(function (child) { return child.className === "customer-business-controls"; });
  });
  assert.equal(controls[0].children[0].disabled, true);
  assert.equal(controls[2].children[1].disabled, true);
  assert.equal(controls[1].children[0].attributes["aria-label"], "Previous business");
  let focused = false;
  let scrolled = false;
  cards[1].focus = function () { focused = true; };
  cards[1].scrollIntoView = function (options) { scrolled = options.block === "nearest"; };
  controls[0].children[1].listeners.click();
  assert.equal(focused && scrolled, true);
  const single = fakeDocument();
  renderCustomerWork(single, work.slice(0, 1), [], async function () {});
  assert.equal(single.elements["customer-work-list"].children[0].children[0].children.some(function (child) {
    return child.className === "customer-business-controls";
  }), false);
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
  assert.equal(mediaRegion.children[0].tag, "a");
  assert.equal(mediaRegion.children[0].href, "https://cdn.example/media.jpg");
  assert.equal(mediaRegion.children[0].children[0].tag, "img");
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
  assert.equal(mediaRegion.children[2].children[0].attributes["data-related-product-id"], undefined);
  assert.equal(mediaRegion.children[0].href, "https://cdn.example/one.jpg");
  assert.equal(mediaRegion.children[1].href, undefined);
  assert.equal(mediaRegion.children[2].href, "https://cdn.example/unknown.jpg");
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
  assert.equal(mediaRegion.children[0].href, "https://cdn.example/one.jpg");
  assert.equal(mediaRegion.children[0].children[0].attributes["data-related-product-id"], "product-1");
  assert.equal(mediaRegion.children[1].href, "https://cdn.example/two.jpg");
  assert.equal(mediaRegion.children[2].href, "https://cdn.example/unknown.jpg");
});

test("Discover continuation uses only the validated available product route", function () {
  const { getCustomerProductContinuationHref } = require("../js/customer.js");
  const work = toCustomerWorkItem({
    workItemId: "controlled-journey", businessName: "Controlled Test Business", content: "Approved test content", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://business.example/approved" },
    products: [
      { productId: "available", name: "Available item", description: "Approved item", continuationRoute: "website", availability: "available" },
      { productId: "unavailable", name: "Unavailable item", description: "Not available", continuationRoute: "website", availability: "unavailable" }
    ]
  });
  assert.equal(getCustomerProductContinuationHref(work, work.products[0]), "https://business.example/approved");
  assert.equal(getCustomerProductContinuationHref(work, work.products[1]), null);
  assert.equal(getCustomerProductContinuationHref(work, { continuationRoute: "booking", availability: "available" }), null);
  assert.equal(getCustomerProductContinuationHref(work, { continuationRoute: "website", availability: "available" }), "https://business.example/approved");
  assert.equal(getCustomerProductContinuationHref({ customerContinuation: { website: "javascript:alert(1)" } }, { continuationRoute: "website" }), null);
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

test("Leaving Discover pauses actual video elements and returning does not resume them", function () {
  const document = fakeDocument();
  const discover = document.elements.discover = new Element("section");
  const intention = document.elements.intention = new Element("section");
  let pauses = 0;
  const video = { pause() { pauses += 1; } };
  discover.querySelectorAll = function (selector) { assert.equal(selector, "video"); return [video]; };
  document.querySelectorAll = function () { return []; };
  applyCustomerSurfaceRoute(document, "#discover");
  assert.equal(pauses, 0);
  applyCustomerSurfaceRoute(document, "#intention");
  assert.equal(pauses, 1);
  assert.equal(discover.hidden, true);
  applyCustomerSurfaceRoute(document, "#discover");
  assert.equal(pauses, 1);
  assert.equal(discover.hidden, false);
});

test("Refreshing Discover pauses old video and disconnects previous visibility observer", function () {
  const originalObserver = global.IntersectionObserver;
  const observers = [];
  global.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  try {
    const document = fakeDocument();
    const list = document.elements["customer-work-list"];
    let pauses = 0;
    list.querySelectorAll = function (selector) { assert.equal(selector, "video"); return [{ pause() { pauses += 1; } }]; };
    const work = [{ workItemId: "approved-a", businessName: "North Star", content: "Approved message", participationAction: "Interested" }];
    renderCustomerWork(document, work, [], async function () {});
    assert.equal(observers.length, 1);
    assert.equal(observers[0].disconnected, false);
    renderCustomerWork(document, [], [], async function () {});
    assert.equal(observers[0].disconnected, true);
    assert.equal(observers.length, 1);
    assert.equal(pauses, 2);
  } finally { global.IntersectionObserver = originalObserver; }
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
    options: { cache: "no-store", headers: { "x-demeos-test-mode": "controlled-preview" } },
    testMode: true
  });
  assert.equal(getDiscoverRequest({ search: "?demeos-test=0" }).testMode, false);
});

test("Discover controlled preview visibly identifies populated test content", async function () {
  const document = fakeDocument();
  await loadCustomerWork(document, async function (url, options) {
    assert.equal(url, "/api/customer/work?demeos-test=1");
    assert.equal(options.headers["x-demeos-test-mode"], "controlled-preview");
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


test("Discover gallery buttons move to the adjacent media item without leaving the gallery", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "gallery-a", businessName: "North Star", content: "Approved media",
    participationAction: "Interested",
    media: [
      { assetId: "a", kind: "image", role: "primary", deliveryUrl: "https://cdn.example.com/a.webp" },
      { assetId: "b", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example.com/b.webp" }
    ]
  }, [], async function () {});
  const message = card.children[1];
  const region = message.children.find((child) => child.className === "customer-work-media");
  const controls = message.children.find((child) => child.className === "customer-media-controls");
  assert.equal(controls.children.length, 2);
  assert.equal(controls.children[0].attributes["aria-label"], "Previous image or video");
  assert.equal(controls.children[1].attributes["aria-label"], "Next image or video");
  region.getBoundingClientRect = () => ({ left: 0 });
  region.children[0].getBoundingClientRect = () => ({ left: 0 });
  region.children[1].getBoundingClientRect = () => ({ left: 300 });
  const moves = [];
  region.scrollBy = (options) => moves.push(options);
  controls.children[1].listeners.click();
  assert.deepEqual(moves[0], { left: 300, behavior: "smooth" });
  controls.children[0].listeners.click();
  assert.deepEqual(moves[1], { left: 0, behavior: "smooth" });
});


test("Playing one Discover video pauses the other video in its business gallery", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "video-gallery", businessName: "North Star", content: "Approved media", participationAction: "Interested",
    media: [
      { assetId: "a", kind: "video", role: "primary", deliveryUrl: "https://cdn.example.com/a.mp4" },
      { assetId: "b", kind: "video", role: "supporting", deliveryUrl: "https://cdn.example.com/b.mp4" }
    ]
  }, [], async function () {});
  const region = card.children[1].children.find((child) => child.className === "customer-work-media");
  let firstPauses = 0; let secondPauses = 0;
  region.children[0].pause = function () { firstPauses += 1; };
  region.children[1].pause = function () { secondPauses += 1; };
  region.querySelectorAll = function () { return region.children; };
  region.children[0].listeners.play();
  assert.equal(firstPauses, 0);
  assert.equal(secondPauses, 1);
  region.children[1].listeners.play();
  assert.equal(firstPauses, 1);
  assert.equal(secondPauses, 1);
});

test("Playing a Discover video pauses a video in another business card", function () {
  const document = fakeDocument();
  let otherPauses = 0;
  const otherVideo = { pause() { otherPauses += 1; } };
  const discover = document.elements.discover = new Element("section");
  const card = createCustomerWorkCard(document, {
    workItemId: "video-a", businessName: "North Star", content: "Approved media", participationAction: "Interested",
    media: [{ assetId: "a", kind: "video", role: "primary", deliveryUrl: "https://cdn.example.com/a.mp4" }]
  }, [], async function () {});
  const region = card.children[1].children.find((child) => child.className === "customer-work-media");
  const active = region.children[0];
  discover.querySelectorAll = function (selector) { assert.equal(selector, "video"); return [active, otherVideo]; };
  active.listeners.play();
  assert.equal(otherPauses, 1);
});

test("Discover media position follows horizontal scroll on narrow screens", function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, {
    workItemId: "gallery-position", businessName: "North Star", content: "Approved media", participationAction: "Interested",
    media: [
      { assetId: "a", kind: "image", role: "primary", deliveryUrl: "https://cdn.example.com/a.webp" },
      { assetId: "b", kind: "video", role: "supporting", deliveryUrl: "https://cdn.example.com/b.mp4" },
      { assetId: "c", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example.com/c.webp" }
    ]
  }, [], async function () {});
  const message = card.children[1];
  const region = message.children.find((child) => child.className === "customer-work-media");
  const position = message.children.find((child) => child.className === "customer-media-position");
  let left = 0;
  region.getBoundingClientRect = () => ({ left: 0 });
  region.children.forEach((item, index) => { item.getBoundingClientRect = () => ({ left: index * 240 - left, width: 240 }); });
  region.children[1].pause = function () {};
  assert.equal(position.textContent, "Media 1 of 3");
  left = 245;
  region.listeners.scroll();
  assert.equal(position.textContent, "Media 2 of 3");
  assert.equal(position.attributes["aria-label"], "Media 2 of 3");
  left = 480;
  region.listeners.scroll();
  assert.equal(position.textContent, "Media 3 of 3");
  left = 0;
  region.listeners.scroll();
  assert.equal(position.textContent, "Media 1 of 3");
});

test("Discover media counter updates when gallery resizes", function () {
  const original = global.ResizeObserver;
  const observers = [];
  global.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(region) { this.region = region; }
    disconnect() { this.disconnected = true; }
  };
  try {
    const document = fakeDocument();
    const card = createCustomerWorkCard(document, {
      workItemId: "resize-gallery", businessName: "North Star", content: "Approved media", participationAction: "Interested",
      media: [
        { assetId: "a", kind: "image", role: "primary", deliveryUrl: "https://cdn.example.com/a.webp" },
        { assetId: "b", kind: "image", role: "supporting", deliveryUrl: "https://cdn.example.com/b.webp" }
      ]
    }, [], async function () {});
    const message = card.children[1];
    const region = message.children.find((child) => child.className === "customer-work-media");
    const position = message.children.find((child) => child.className === "customer-media-position");
    assert.equal(observers.length, 1);
    let left = 0;
    region.getBoundingClientRect = () => ({ left: 0 });
    region.children.forEach((item, index) => { item.getBoundingClientRect = () => ({ left: index * 200 - left }); });
    left = 200;
    observers[0].callback();
    assert.equal(position.textContent, "Media 2 of 2");
    assert.equal(position.attributes["aria-label"], "Media 2 of 2");
  } finally { global.ResizeObserver = original; }
});

test("a late possibilities response cannot replace the latest customer request", async function () {
  const document = fakeDocument();
  const ids = ["customer-possibilities", "customer-possibilities-heading", "customer-possibilities-list",
    "customer-focused-possibility", "customer-possibility-intention"];
  ids.forEach((id) => { document.elements[id] = new Element(); });
  const pending = [];
  const fetcher = (url) => {
    if (url === "/api/customer/possibilities") return new Promise((resolve) => pending.push(resolve));
    throw new Error("Unexpected request");
  };
  const first = requestCustomerPossibilities(document, { intention: "First", confidenceState: "confirmed" }, fetcher, {});
  const second = requestCustomerPossibilities(document, { intention: "Second", confidenceState: "confirmed" }, fetcher, {});
  assert.equal(pending.length, 2);
  pending[0]({ ok: true, json: async () => ({ possibilities: [] }) });
  await first;
  assert.equal(document.elements["customer-possibilities-heading"].textContent, "Preparing possibilities connected to what you asked for…");
  pending[1]({ ok: false, json: async () => ({ possibilities: [] }) });
  await second;
  assert.notEqual(document.elements["customer-possibilities-heading"].textContent, "Preparing possibilities connected to what you asked for…");
});


test("customer possibilities failure offers retry for the same confirmed request", async function () {
  const document = fakeDocument();
  ["customer-possibilities", "customer-possibilities-heading", "customer-possibilities-list",
    "customer-focused-possibility", "customer-possibility-intention"].forEach((id) => {
    document.elements[id] = new Element();
  });
  const requests = [];
  let resolveRetry;
  const fetcher = (url, options) => {
    if (url !== "/api/customer/possibilities") throw new Error("Unexpected request");
    requests.push(JSON.parse(options.body).understanding);
    if (requests.length === 1) return Promise.resolve({ ok: false, json: async () => ({}) });
    return new Promise((resolve) => { resolveRetry = resolve; });
  };
  const understanding = { intention: "Birthday cake", customerText: "For Saturday", confidenceState: "confirmed" };
  await requestCustomerPossibilities(document, understanding, fetcher, {});
  const list = document.elements["customer-possibilities-list"];
  const note = list.children.find((child) => child.className === "customer-possibilities-error-note");
  const retry = list.children.find((child) => child.className === "customer-possibilities-retry");
  assert.ok(note);
  assert.match(note.textContent, /temporary loading problem/);
  assert.equal(retry.textContent, "Try again");
  retry.listeners.click();
  assert.equal(retry.disabled, true);
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(list.children.length, 0);
  resolveRetry({ ok: false, json: async () => ({}) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(list.children.filter((child) => child.className === "customer-possibilities-retry").length, 1);
});

test("changing customer intention invalidates outstanding possibility responses before hiding results", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  const change = source.match(/function changeIntention\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(change, "customer intention reset must exist");
  const invalidate = change[1].indexOf("++customerPossibilitiesRequestSequence;");
  const hide = change[1].indexOf("possibilityRegion.hidden = true;");
  assert.ok(invalidate >= 0 && hide > invalidate, "invalidate pending requests before hiding old results");
  assert.match(source, /if \(requestSequence !== customerPossibilitiesRequestSequence\) return;/);
});


test("a new customer request clears the old no-match state before its response arrives", async function () {
  const document = fakeDocument();
  ["customer-possibilities", "customer-possibilities-heading", "customer-possibilities-header",
    "customer-possibility-space", "customer-no-possibilities", "customer-change-intention",
    "customer-possibilities-list", "customer-focused-possibility", "customer-possibility-intention"].forEach((id) => {
    document.elements[id] = new Element();
  });
  document.elements["customer-possibilities-header"].hidden = true;
  document.elements["customer-possibility-space"].hidden = true;
  document.elements["customer-no-possibilities"].hidden = false;
  document.elements["customer-change-intention"].hidden = true;
  const region = document.elements["customer-possibilities"];
  region.attributes["aria-labelledby"] = "customer-no-possibilities-heading";
  let resolveRequest;
  const fetcher = () => new Promise((resolve) => { resolveRequest = resolve; });
  const pending = requestCustomerPossibilities(document,
    { intention: "Fresh request", confidenceState: "confirmed" }, fetcher, {});
  assert.equal(document.elements["customer-no-possibilities"].hidden, true);
  assert.equal(document.elements["customer-possibilities-header"].hidden, false);
  assert.equal(document.elements["customer-possibility-space"].hidden, false);
  assert.equal(document.elements["customer-change-intention"].hidden, false);
  assert.equal(region.attributes["aria-labelledby"], "customer-possibilities-heading");
  assert.equal(document.elements["customer-possibilities-heading"].textContent,
    "Preparing possibilities connected to what you asked for…");
  resolveRequest({ ok: false, json: async () => ({}) });
  await pending;
});


test("customer relevance preview only accepts the validated explanation", function () {
  const valid = {
    possibilityId: "p1", workItemId: "w1", businessName: "Example business",
    content: "Approved customer content", participationAction: "Interested",
    relevance: { basis: "current-intention-authorized-work", evidence: ["cake"],
      explanation: "This authorized possibility connects to your current request." }
  };
  const { getValidCustomerPossibilities } = require("../js/customer.js");
  const accepted = getValidCustomerPossibilities([valid]);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].relevance.explanation, valid.relevance.explanation);
  assert.equal(getValidCustomerPossibilities([{ ...valid, relevance: {
    ...valid.relevance, explanation: "Guaranteed perfect match for you." } }]).length, 0);
  assert.equal(getValidCustomerPossibilities([{ ...valid, relevance: {
    ...valid.relevance, basis: "unverified" } }]).length, 0);
});


test("confirmed customer intention renders only validated business possibilities and their approved relevance", function () {
  const { renderCustomerPossibilities } = require("../js/customer.js");
  const document = fakeDocument();
  ["customer-possibilities", "customer-possibilities-heading", "customer-possibilities-list",
    "customer-focused-possibility", "customer-possibility-intention", "customer-possibilities-header",
    "customer-possibility-space", "customer-change-intention", "customer-no-possibilities"].forEach((id) => {
    document.elements[id] = new Element();
  });
  document.elements["customer-possibilities-heading"].focus = () => {};
  const valid = { possibilityId: "p1", workItemId: "w1", businessName: "Example business",
    content: "Approved business offering", participationAction: "Interested",
    relevance: { basis: "current-intention-authorized-work", evidence: ["cake"],
      explanation: "This authorized possibility connects to your current request." } };
  const invalid = { ...valid, possibilityId: "p2", relevance: {
    ...valid.relevance, explanation: "Guaranteed perfect match." } };
  renderCustomerPossibilities(document, [invalid, valid],
    { intention: "Cake", understanding: "Looking for a cake", confidenceState: "confirmed" },
    async () => {}, async () => {}, {}, {});
  const cards = document.elements["customer-possibilities-list"].children;
  assert.equal(cards.length, 1);
  assert.match(cards[0].textContent, /Matching evidence from published business information: cake. This is a possible connection, not confirmation that all your requirements are met/);
  assert.doesNotMatch(cards[0].textContent, /Guaranteed perfect match/);
  cards[0].listeners.click();
  const focus = document.elements["customer-focused-possibility"];
  assert.equal(focus.hidden, false);
  assert.match(focus.textContent, /Approved business offering/);
  assert.match(focus.textContent, /Matching evidence from published business information: cake. This is a possible connection, not confirmation that all your requirements are met/);
  assert.equal(focus.children.some((child) => child.className === "customer-business-continuation"), false);
  const save = focus.children.find((child) => child.className === "customer-possibility-save");
  const signInLink = save.children.find((child) => child.className === "customer-possibility-sign-in");
  assert.equal(signInLink.href, "my-demeos.html");
  assert.equal(save.children.some((child) => child.className === "customer-possibility-save-button"), false);
});


test("customer continuation uses supplied business routes and excludes unsupported routes", function () {
  const { renderCustomerPossibilities } = require("../js/customer.js");
  const document = fakeDocument();
  ["customer-possibilities", "customer-possibilities-heading", "customer-possibilities-list",
    "customer-focused-possibility", "customer-possibility-intention", "customer-possibilities-header",
    "customer-possibility-space", "customer-change-intention", "customer-no-possibilities"].forEach((id) => {
    document.elements[id] = new Element();
  });
  document.elements["customer-possibilities-heading"].focus = () => {};
  const possibility = { possibilityId: "p1", workItemId: "w1", businessName: "Example business",
    content: "Approved business offering", participationAction: "Interested",
    relevance: { basis: "current-intention-authorized-work", evidence: ["cake"],
      explanation: "This authorized possibility connects to your current request." },
    customerContinuation: { routes: ["website", "booking", "unknown", "email"],
      website: "https://business.example/products", email: "hello@business.example" } };
  renderCustomerPossibilities(document, [possibility],
    { intention: "Cake", understanding: "Looking for cake", confidenceState: "confirmed" },
    async () => {}, async () => {}, {}, {});
  document.elements["customer-possibilities-list"].children[0].listeners.click();
  const focus = document.elements["customer-focused-possibility"];
  const continuation = focus.children.find((child) => child.className === "customer-business-continuation");
  assert.ok(continuation);
  const actions = continuation.children.find((child) => child.className === "customer-continuation-actions");
  const links = actions.children.filter((child) => child.tag === "a");
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((child) => child.href),
    ["https://business.example/products", "mailto:hello@business.example"]);
  assert.equal(links[0].rel, "noopener noreferrer");
  assert.equal(actions.children.some((child) => child.textContent === "Book / order"), false);
});


test("tablet intention layout removes orbital lines and keeps six choices in a two-column grid", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/customer-mobile-refinement.css"), "utf8");
  const tablet = css.match(/\/\* Tablet intention: use an intentional grid rather than the desktop orbital decoration\. \*\/([\s\S]*?)\n\}/);
  assert.ok(tablet, "tablet-specific intention rules must exist");
  const rules = tablet[1];
  assert.match(rules, /min-width:681px/);
  assert.match(rules, /max-width:1180px/);
  assert.match(rules, /\.customer-intention-form fieldset::before,[\s\S]*?\.customer-intention-options::after\s*\{content:none!important;display:none!important\}/);
  assert.match(rules, /\.customer-intention-options\s*\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(rules, /\.customer-intention-option:nth-child\(n\)\s*\{position:relative;inset:auto;transform:none/);
});

test("Discover touch guidance explains both business and media navigation", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  assert.match(html, /Swipe up or down between businesses · swipe left or right through media/);
});

test("Discover tablet presentation keeps business and media lanes contained", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/customer-mobile-refinement.css"), "utf8");
  const tablet = css.split("/* Tablet Discover: a compact, usable business surface rather than stretched desktop panels. */")[1];
  assert.ok(tablet, "tablet Discover presentation must exist");
  assert.match(tablet, /min-width:681px/);
  assert.match(tablet, /max-width:1180px/);
  assert.match(tablet, /#discover \.customer-work-card\s*\{[^}]*min-height:0/);
  assert.match(tablet, /#discover \.customer-work-media\s*\{[^}]*overflow-x:auto/);
  assert.match(tablet, /#discover \.customer-discover-option-image\s*\{[^}]*aspect-ratio:1 \/ 1/);
});


test("controlled testing always offers normal-mode exit even on disabled or failed requests", async function () {
  for (const response of [{ok:true,json:async()=>({work:[],testMode:false})},{ok:false,json:async()=>({error:"unavailable"})}]) {
    const document = fakeDocument();
    document.elements["customer-controlled-test-entry"] = new Element("a");
    document.elements["customer-controlled-test-exit"] = new Element("a");
    await loadCustomerWork(document,async()=>response,{search:"?demeos-test=1"});
    assert.equal(document.elements["customer-controlled-test-entry"].hidden,true);
    assert.equal(document.elements["customer-controlled-test-exit"].hidden,false);
    assert.equal(document.elements["customer-work-list"].children.length,0);
    assert.match(document.elements["customer-work-status"].className,/customer-load-error/);
  }
});
