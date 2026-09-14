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
    "customer-possibility-intention": new Element("div")
  };
  return { elements, createElement(tag) { return new Element(tag); }, getElementById(id) { return elements[id]; } };
}

function possibility(overrides = {}) {
  return {
    possibilityId: "possibility_safe", workItemId: "work/a", businessName: "Bella Vista Bistro",
    location: "London", content: "A relaxed family dinner.", participationAction: "Interested",
    relevance: { basis: "explicit-customer-intent-overlap", evidence: ["dinner", "family", "relaxed"] },
    ...overrides
  };
}

const understanding = {
  intention: "Spend time together", customerText: "A relaxed dinner with my family",
  understanding: "You’d like to spend time together and are looking for a relaxed dinner with your family.",
  source: "customer-provided", confidenceState: "confirmed"
};

test("client validates each trusted possibility and skips malformed entries individually", function () {
  assert.deepEqual(getValidCustomerPossibilities([
    possibility(), possibility({ possibilityId: "" }), possibility({ participationAction: "Book" }),
    possibility({ relevance: { basis: "browser-guess", evidence: ["invented"] } })
  ]), [possibility()]);
  assert.equal(toCustomerPossibility(possibility({ location: { city: "London" } })), null);
  assert.equal(toCustomerPossibility(possibility({ relevance: { basis: "explicit-customer-intent-overlap", evidence: [] } })), null);
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

  const participationSection = focused.children.at(-1);
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
