const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Customer Interface exposes simple relationship navigation without changing its journey scripts", function () {
  const html = read("customer.html");
  assert.match(html, /<nav class="customer-journey-nav" aria-label="Customer navigation">/);
  assert.match(html, /href="#customer-intention-form">New intention<\/a>/);
  assert.match(html, /href="my-demeos\.html">My DEMEOS<\/a>/);
  assert.match(html, /<script src="js\/customer-understanding\.js"><\/script>[\s\S]*<script src="js\/customer\.js"><\/script>[\s\S]*<script src="js\/customer-continuation\.js"><\/script>/);
});

test("My DEMEOS uses the official logo and accessible, current-section navigation", function () {
  const html = read("my-demeos.html");
  assert.match(html, /href="customer\.html" aria-label="Return to the DEMEOS Customer Interface">\s*<img src="images\/demeos-logo\.png" alt="DEMEOS"/);
  assert.match(html, /<nav class="customer-journey-nav" aria-label="Customer navigation">/);
  assert.match(html, /href="customer\.html#customer-intention-form">New intention<\/a>/);
  assert.match(html, /class="is-current" href="my-demeos\.html" aria-current="page">My DEMEOS<\/a>/);
  assert.match(html, /<main class="my-demeos-main">/);
  assert.match(html, /<h1>My DEMEOS<\/h1>/);
});

test("profile foundation presents trusted DEMEOS entry language and honest empty relationship areas", function () {
  const html = read("my-demeos.html");
  assert.match(html, /<h2>Enter My DEMEOS<\/h2>/);
  assert.match(html, /type="button">Enter My DEMEOS<\/button>/);
  assert.match(html, /type="button">Leave My DEMEOS<\/button>/);
  assert.match(html, /Checking your DEMEOS relationship securely\./);
  assert.match(html, /Enter My DEMEOS to keep and see your intentions across visits\./);
  assert.match(html, /Enter My DEMEOS to keep and see your possibilities across visits\./);
  assert.match(html, /Enter My DEMEOS to see your participation across visits\./);
  assert.doesNotMatch(html, />Sign (?:in|out)(?: to My DEMEOS)?</);
  assert.match(html, /Your secure DEMEOS relationship is active\./);
  assert.match(html, /Customer sign-in is not available yet\./);
  assert.match(html, /requires Clerk provider configuration before it can be activated\./);
  for (const heading of ["My Intentions", "My Possibilities", "My Participation", "My Preferences"]) {
    assert.match(html, new RegExp(`role="heading" aria-level="3">${heading}<\\/span>`));
  }
  assert.match(html, /<h3 id="privacy-control-title" class="my-demeos-area-title">Privacy &amp; Control<\/h3>/);
  assert.match(html, /Interest remains interest\. Feedback remains feedback\. A choice is not automatically a purchase, sale or success\./);
  assert.doesNotMatch(html, /localStorage|sessionStorage|randomUUID|crypto\.|owner-auth|owner-sign-in|business-workspace\.js/i);
  assert.doesNotMatch(html, /reward|points|discount|membership|order history|purchase history/i);
  assert.match(html, /<script src="js\/my-demeos\.js"><\/script>/);
  assert.doesNotMatch(html, /data-customer-id|customerId|\b\d+\s+(intentions|possibilities|participations)/i);
});

test("My DEMEOS responsive styles preserve focus visibility and a single-column mobile reading flow", function () {
  const css = read("css/style.css");
  assert.match(css, /\.customer-journey-nav a:focus-visible, \.customer-brand:focus-visible \{ outline: 3px solid #8fc1ff;/);
  assert.match(css, /\.my-demeos-areas \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.my-demeos-areas \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.my-demeos-area \{[^}]*min-width: 0;[^}]*min-height: 210px;/);
  assert.match(css, /\.my-demeos-area-active:focus-visible[^}]*outline: 3px solid #8fc1ff;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.my-demeos-area-active \{ transition: none; \}/);
});
