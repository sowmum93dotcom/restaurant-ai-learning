const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  CUSTOMER_STAGE_THREE_COPY, getValidCustomerPossibilities, renderCustomerPossibilities,
  toCustomerPossibility
} = require("../js/customer.js");

class Element {
  constructor(tag = "div") {
    this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {};
    this._text = ""; this.className = ""; this.hidden = false; this.focused = false;
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  set textContent(value) { this._text = value; if (!value) this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
}

function fakeDocument() {
  const elements = {
    "customer-possibilities": new Element("section"),
    "customer-possibilities-heading": new Element("h2"),
    "customer-possibilities-list": new Element(),
    "customer-focused-possibility": new Element("div"),
    "customer-possibility-intention": new Element("div"),
    "customer-possibilities-header": new Element("header"),
    "customer-possibility-space": new Element("div"),
    "customer-change-intention": new Element("button"),
    "customer-no-possibilities": new Element("section"),
    "customer-no-possibilities-heading": new Element("h2")
  };
  return { elements, createElement(tag) { return new Element(tag); }, getElementById(id) { return elements[id]; } };
}

function possibility(overrides = {}) {
  return {
    possibilityId: "possibility_safe", workItemId: "work/a", businessName: "Bella Vista Bistro",
    location: "London", content: "A relaxed family dinner.", participationAction: "Interested",
    relevance: { basis: "current-intention-authorized-work", evidence: ["dinner", "family", "relaxed"],
      explanation: "This authorized possibility connects to your current request." },
    ...overrides
  };
}

const understanding = {
  intention: "Spend time together", customerText: "A relaxed dinner with my family",
  understanding: "You’d like to spend time together and are looking for a relaxed dinner with your family.",
  source: "customer-provided", confidenceState: "confirmed"
};

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

async function openProduct(overrides = {}) {
  const document = fakeDocument();
  const participation = [];
  renderCustomerPossibilities(document, [possibility({
    customerContinuation: { routes: ["website"], website: "https://business.example/menu" },
    products: [{ productId: "dinner", name: "Family dinner", description: "Fresh family dinner with seasonal vegetables.",
      imageUrl: "https://business.example/dinner.jpg", availability: "available", continuationRoute: "website", ...overrides }]
  })], understanding, async (item) => participation.push(item));
  await document.elements["customer-possibilities-list"].children[0].listeners.click();
  const card = descendants(document.elements["customer-focused-possibility"])
    .find((element) => element.className === "customer-product-card");
  return { card, participation };
}

test("failed product images retain details and the same business continuation without creating interest", async function () {
  const { card, participation } = await openProduct();
  const image = descendants(card).find((element) => element.tag === "img");
  const link = descendants(card).find((element) => element.tag === "a");
  assert.equal(image.src, "https://business.example/dinner.jpg");
  assert.doesNotMatch(card.textContent, /Image unavailable/);
  image.listeners.error();
  assert.equal(descendants(card).filter((element) => element.tag === "img").length, 0);
  assert.match(link.textContent, /Image unavailable/);
  assert.equal(link.href, "https://business.example/menu");
  assert.equal(link.attributes["aria-label"], "Family dinner — continue with Bella Vista Bistro");
  const fallback = descendants(card).find((element) => element.className === "customer-product-no-image");
  assert.match(fallback.attributes["aria-label"], /Family dinner could not be loaded/);
  const button = descendants(card).find((element) => element.className === "customer-product-detail-button");
  button.listeners.click();
  const details = descendants(card).find((element) => element.className === "customer-product-details");
  assert.equal(details.hidden, false);
  assert.match(details.textContent, /Fresh family dinner with seasonal vegetables/);
  assert.equal(descendants(details).find((element) => element.tag === "a").href, link.href);
  assert.equal(participation.length, 0);
});

test("image failure does not enable continuation for an unavailable product", async function () {
  const { card, participation } = await openProduct({ availability: "unavailable" });
  descendants(card).find((element) => element.tag === "img").listeners.error();
  assert.match(card.textContent, /Image unavailable/);
  assert.equal(descendants(card).filter((element) => element.tag === "a").length, 0);
  assert.match(card.textContent, /not currently available/);
  assert.equal(participation.length, 0);
});

test("products without an image keep their distinct missing-image state", async function () {
  const { card } = await openProduct({ imageUrl: "" });
  assert.equal(descendants(card).filter((element) => element.tag === "img").length, 0);
  assert.match(card.textContent, /Product information available/);
  assert.doesNotMatch(card.textContent, /Image unavailable/);
});

test("client validates each trusted possibility and skips malformed entries individually", function () {
  assert.deepEqual(getValidCustomerPossibilities([
    possibility(), possibility({ possibilityId: "" }), possibility({ participationAction: "Book" }),
    possibility({ relevance: { basis: "browser-guess", evidence: ["invented"], explanation: "Unsafe" } })
  ]), [possibility()]);
  assert.equal(toCustomerPossibility(possibility({ location: { city: "London" } })), null);
  assert.equal(toCustomerPossibility(possibility({ relevance: { basis: "current-intention-authorized-work", evidence: [],
    explanation: "This authorized possibility connects to your current request." } })), null);
});

test("Stage 3 centres the confirmed understanding and renders trusted evidence without exposing identifiers", function () {
  const document = fakeDocument();
  renderCustomerPossibilities(document, [possibility()], understanding, async function () {});
  const output = document.elements["customer-possibilities"].textContent +
    document.elements["customer-possibility-intention"].textContent +
    document.elements["customer-possibilities-list"].textContent;
  assert.match(output, /Your intention|Spend time together|You’d like to spend time together/);
  assert.match(output, /A relaxed family dinner|Provided by Bella Vista Bistro/);
  assert.doesNotMatch(output, /possibility_safe|work\/a|score|percentage|ranking|best|top|recommended/i);
});

test("Stage 3 remains hidden without an explicitly confirmed understanding", function () {
  const document = fakeDocument();
  renderCustomerPossibilities(document, [possibility()], { ...understanding, confidenceState: "ready-for-confirmation" });
  assert.equal(document.elements["customer-possibilities"].hidden, true);
  assert.equal(document.elements["customer-possibilities-list"].children.length, 0);
});

test("an empty server result renders the trusted continuation state and no possibility", function () {
  const document = fakeDocument();
  renderCustomerPossibilities(document, [], understanding);

  assert.equal(document.elements["customer-possibilities"].hidden, false);
  assert.equal(document.elements["customer-no-possibilities"].hidden, false);
  assert.equal(document.elements["customer-possibility-space"].hidden, true);
  assert.equal(document.elements["customer-possibilities-list"].children.length, 0);
  assert.equal(document.elements["customer-no-possibilities-heading"].focused, true);
  assert.equal(document.elements["customer-possibilities"].attributes["aria-labelledby"], "customer-no-possibilities-heading");
  assert.equal(document.elements["customer-possibilities-heading"].textContent,
    "DEMEOS doesn’t have a sufficiently supported possibility yet.");
});

test("selecting a possibility opens its readable surface and back restores the space", async function () {
  const document = fakeDocument();
  const participation = [];
  renderCustomerPossibilities(document, [possibility()], understanding, async function (item) { participation.push(item); });
  const list = document.elements["customer-possibilities-list"];
  await list.children[0].listeners.click();
  const focused = document.elements["customer-focused-possibility"];
  assert.equal(focused.hidden, false);
  assert.match(focused.textContent, /Why this appeared|dinner · family · relaxed|Provided by|Bella Vista Bistro|London/);
  assert.match(focused.textContent, /Interested is an interest signal only\. It is not a purchase, booking or sale\./);
  assert.equal(participation.length, 0, "participation is never automatic");

  const participationSection = focused.children.at(-2);
  await participationSection.children[2].listeners.click();
  assert.equal(participation[0].workItemId, "work/a");
  assert.match(focused.textContent, /Interest shared|Your interest has been shared with this business/);
  assert.doesNotMatch(focused.textContent, /purchased|booked|sale completed/i);

  await focused.children[0].listeners.click();
  assert.equal(focused.hidden, true);
  assert.equal(list.className, "customer-possibilities-list");
});

test("Customer Interface makes Stage 3 primary, keeps its copy centralized, and retains accessible responsive motion rules", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "css/style.css"), "utf8");
  assert.match(html, /customer-focused-possibility[^>]*role="region"[^>]*aria-live="polite"/);
  assert.match(html, /customer-approved-work-fallback[^>]*hidden/);
  assert.match(html, /images\/demeos-logo\.png/);
  assert.match(source, /understandingPanel\.hidden = true;[\s\S]*requestCustomerPossibilities/);
  assert.match(source, /currentUnderstanding = null;[\s\S]*possibilityRegion\.hidden = true/);
  assert.equal((source.match(/requestCustomerPossibilities\(document, currentUnderstanding/g) || []).length, 1);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.customer-possibility-space[\s\S]*flex-direction: column/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.customer-possibility-surface[\s\S]*transition: none/);
  assert.doesNotMatch(CUSTOMER_STAGE_THREE_COPY.found, /best|top|recommended|score|perfect|ideal/i);
  assert.doesNotMatch(html, /filter|search results|rating|review|price|availability|map|booking/i);
});

test("trusted empty-state refinement is explicit, bounded, and returns through fresh confirmation", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  const continuation = fs.readFileSync(path.join(__dirname, "..", "js/customer-continuation.js"), "utf8");
  const emptyMarkup = html.slice(html.indexOf('id="customer-no-possibilities"'), html.indexOf("</section>", html.indexOf('id="customer-no-possibilities"')));

  assert.match(emptyMarkup, /Your Possibilities/);
  assert.match(emptyMarkup, /DEMEOS doesn’t have a sufficiently supported possibility yet\./);
  assert.match(emptyMarkup, /Your intention is clear\. DEMEOS will only show a possibility when the available information supports the connection\./);
  assert.match(emptyMarkup, /Add more detail/);
  assert.match(emptyMarkup, /Change my intention/);
  assert.match(emptyMarkup, /textarea[^>]*maxlength="500"/);
  assert.match(source, /customer-add-detail[^]*addEventListener\("click"[^]*\.focus\(\)/);
  assert.match(source, /customer-add-detail-form[^]*addEventListener\("submit"[^]*preventDefault[^]*source: "customer-provided"|customer-add-detail-form[^]*addEventListener\("submit"[^]*showUnderstanding/);
  assert.match(source, /showUnderstanding\(""\);[^]*customer-understanding-confirm[^]*confirmCustomerUnderstanding[^]*requestCustomerPossibilities/);
  assert.match(source, /customer-empty-change-intention[^]*changeIntention/);
  assert.doesNotMatch(source.slice(source.indexOf('customer-empty-change-intention'), source.indexOf('customer-understanding-confirm')), /selectedIntention\s*=\s*""/);
  assert.match(continuation, /intentionText\.value = ""[^]*clarificationText\.value = ""[^]*aria-pressed", "false"/);
  assert.doesNotMatch(emptyMarkup, /no results|nothing found|try another search|no businesses available|best match|recommended|sponsored|score|ranking|rating|filter|map|price|booking/i);
});
