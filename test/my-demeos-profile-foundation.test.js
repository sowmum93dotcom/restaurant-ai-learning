const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Customer Interface exposes simple relationship navigation without changing its journey scripts", function () {
  const html = read("customer.html");
  assert.match(html, /<nav class="customer-journey-nav" aria-label="Customer navigation">/);
  assert.match(html, /href="#intention">I know what I want<\/a>/);
  assert.match(html, /href="my-demeos\.html">My DEMEOS<\/a>/);
  assert.match(html, /<script src="js\/customer-understanding\.js"><\/script>[\s\S]*<script src="js\/customer\.js"><\/script>[\s\S]*<script src="js\/customer-continuation\.js"><\/script>/);
});

test("My DEMEOS uses the official logo and accessible, current-section navigation", function () {
  const html = read("my-demeos.html");
  assert.match(html, /href="customer\.html" aria-label="Return to the DEMEOS Customer Interface">\s*<img src="images\/demeos-logo\.png" alt="DEMEOS"/);
  assert.match(html, /<nav class="customer-journey-nav" aria-label="Customer navigation">/);
  assert.match(html, /href="customer\.html#discover">Discover<\/a>/);
  assert.match(html, /href="customer\.html#intention">I know what I want<\/a>/);
  assert.match(html, /class="is-current" href="my-demeos\.html" aria-current="page">My DEMEOS<\/a>/);
  assert.match(html, /<main class="my-demeos-main">/);
  assert.match(html, /<h1>My DEMEOS<\/h1>/);
});

test("profile foundation presents trusted DEMEOS entry language and honest empty relationship areas", function () {
  const html = read("my-demeos.html");
  assert.match(html, /<h2>Sign in to My DEMEOS<\/h2>/);
  assert.match(html, /type="button">Sign in <span aria-hidden="true">→<\/span><\/button>/);
  assert.match(html, /type="button">Sign out<\/button>/);
  assert.match(html, /Checking your DEMEOS relationship securely\./);
  assert.match(html, /Sign in to My DEMEOS to keep and see your intentions across visits\./);
  assert.match(html, /Sign in to My DEMEOS to keep and see your possibilities across visits\./);
  assert.match(html, /Sign in to My DEMEOS to see your participation across visits\./);
  assert.match(html, /Your sign-in session is active\. Relationship data is shown only after verification\./);
  assert.match(html, /Customer sign-in is not available yet\./);
  assert.match(html, /requires Clerk provider configuration before it can be activated\./);
  for (const heading of ["My Intentions", "My Possibilities", "My Participation", "My Preferences"]) {
    assert.match(html, new RegExp(`role="heading" aria-level="3">${heading}<\\/span>`));
  }
  assert.match(html, /data-relationship-area="privacy-control"[^]*Privacy &amp; Control/);
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

test("signed-in account controls remain visible while inactive auth states stay hidden", function () {
  const { showState } = require("../js/my-demeos.js");
  const elements = { status: { hidden: true }, loading: { hidden: false }, signedOut: { hidden: true }, signedIn: { hidden: true }, unavailable: { hidden: true } };
  showState(elements, "signedIn");
  assert.equal(elements.status.hidden, false);
  assert.equal(elements.signedIn.hidden, false);
  assert.equal(elements.signedOut.hidden, true);
  assert.equal(elements.loading.hidden, true);
  showState(elements, "signedOut");
  assert.equal(elements.status.hidden, false);
  assert.equal(elements.signedIn.hidden, true);
  assert.equal(elements.signedOut.hidden, false);
});

test("sign out follows provider session while relationship data remains trusted-only", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /const hasProviderSession = Boolean\(clerk\.user\)/);
  assert.match(script, /const authenticated = hasProviderSession \? await confirmTrustedCustomer\(fetchFunction\) : false/);
  assert.match(script, /showState\(authElements, hasProviderSession \? "signedIn" : "signedOut"\)/);
  assert.match(script, /getElementById\("my-intentions-signed-in"\)\.hidden = !authenticated/);
  assert.match(script, /authElements\.signOut\.addEventListener\("click", function \(\) \{ clerk\.signOut\(\); \}\)/);
});

test("customer relationship data errors cannot replace sign-in state", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(authenticated\) await Promise\.allSettled\(\[loadIntentions/);
  assert.doesNotMatch(script, /if \(authenticated\) await Promise\.all\(\[loadIntentions/);
});

test("issued customer possibilities query uses the actual issuance schema", function () {
  const persistence = read("api/_lib/persistence.js");
  assert.match(persistence, /WHERE i\.trusted_customer_identity_id = \$1\s+ORDER BY i\.issued_at DESC/);
  assert.doesNotMatch(persistence, /i\.delivery_confirmed/);
});

test("saved possibilities failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = "Your possibilities could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /status\.textContent = "";\s+let result;/);
});

test("saved intentions failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = "Your intentions could not be loaded\. Please refresh to try again\."/);
});

test("participation load failure is announced and can be retried", function () {
  const script = read("js/my-demeos.js");
  const html = read("my-demeos.html");
  assert.match(script, /loading\.textContent = "Your participation could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /loading\.textContent = "Loading your participation…";\s+loading\.hidden = false;/);
  assert.match(html, /id="my-participation-loading" role="status" aria-live="polite"/);
});

test("preferences load failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = "Your preferences could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /loading\.textContent = "Loading your preferences…";\s+loading\.hidden = false;/);
});

test("privacy controls cannot be saved when existing settings fail to load", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = "Your privacy controls could not be loaded\. Please refresh to try again\.";\s+return;/);
  assert.match(script, /if \(submit\) submit\.disabled = true;\s+status\.textContent = "Loading your privacy controls…";/);
  assert.match(script, /if \(response\.ok\) await loadPrivacyControls\(documentObject, fetchFunction\);\s+else if \(submit\) submit\.disabled = false;/);
});
