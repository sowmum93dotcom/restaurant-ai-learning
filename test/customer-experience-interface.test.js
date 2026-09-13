const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createCustomerWorkCard, getServerCustomerPackages, recordParticipation, renderCustomerWork } = require("../js/customer.js");

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

test("participation gives accurate signal confirmation", async function () {
  const document = fakeDocument();
  const card = createCustomerWorkCard(document, { workItemId: "a", businessName: "North Star",
    location: "Leeds", content: "Approved message", participationAction: "Interested" }, [], async function () {});
  const button = card.children[3].children[1];
  await button.listeners.click();
  assert.match(card.textContent, /participation signal has been shared/);
  assert.doesNotMatch(card.textContent, /unique customer|customer count/i);
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

  assert.match(card.textContent, /04 · Participate|Interested|interest signal only/i);
  assert.match(card.textContent, /not a purchase, booking or sale/i);
  assert.doesNotMatch(card.textContent, /buy now|checkout|converted|subscribe now|package accepted/i);
});

test("page presents the four-step customer journey and no owner interface", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  for (const step of ["Discover", "Understand", "Choose", "Participate"]) assert.match(html, new RegExp(step));
  for (const anchor of ["discover", "understand", "choose", "participate"]) assert.match(html, new RegExp(`href="#${anchor}"`));
  assert.match(html, /images\/demeos-logo\.png/);
  assert.match(html, /customer-path/);
  assert.doesNotMatch(html, /business profile|recommendation|campaign strategy|email strategy|approval controls|capability registry|dashboard|ratings|prices|discounts|opening hours/i);
});

test("Customer Interface retains responsive layouts for the journey and participation action", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/style.css"), "utf8");
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-path[\s\S]*?grid-template-columns: repeat\(2, 1fr\)/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-participation[\s\S]*?flex-direction: column/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.customer-participation-button \{ width: 100%; \}/);
});
