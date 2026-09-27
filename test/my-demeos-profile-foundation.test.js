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
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = successMessage \? "The saved possibility was removed, but your possibilities could not be refreshed\. Please refresh the page\." : "Your possibilities could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /status\.textContent = "";\s+let result;/);
});

test("saved intentions failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = successMessage \? "The saved intention was removed, but your intentions could not be refreshed\. Please refresh the page\." : "Your intentions could not be loaded\. Please refresh to try again\."/);
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
  assert.match(script, /"Your preferences could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /loading\.textContent = "Loading your preferences…";\s+loading\.hidden = false;/);
});

test("privacy controls cannot be saved when existing settings fail to load", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = successMessage \? "Your privacy controls were saved, but could not be refreshed\. Please refresh the page before making further changes\." : "Your privacy controls could not be loaded\. Please refresh to try again\.";\s+return;/);
  assert.match(script, /if \(submit\) submit\.disabled = true;\s+status\.textContent = "Loading your privacy controls…";/);
  assert.match(script, /if \(response\.ok\) await loadPrivacyControls\(documentObject, fetchFunction, "Privacy controls saved\."\);\s+else status\.textContent = "Your privacy controls could not be saved\.";\s+if \(!response\.ok && submit\) submit\.disabled = false;/);
});

test("privacy controls save recovers from a network failure", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = "Your privacy controls could not be saved\. Please try again\.";\s+if \(submit\) submit\.disabled = false;\s+return;/);
  assert.match(script, /if \(response\.ok\) await loadPrivacyControls\(documentObject, fetchFunction, "Privacy controls saved\."\);\s+else status\.textContent = "Your privacy controls could not be saved\.";\s+if \(!response\.ok && submit\) submit\.disabled = false;/);
});

test("preference creation recovers from a network failure without clearing input", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = "Your preference could not be saved\. Please try again\.";\s+if \(submit\) submit\.disabled = false;\s+return;/);
  assert.match(script, /if \(!response\.ok\) \{ status\.textContent = "Your preference could not be saved\."; if \(submit\) submit\.disabled = false; return; \}/);
});

test("preference removal reports failed requests without removing the displayed item", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!removed\.ok\) throw new Error\("Removal failed"\);\s+await loadPreferences\(documentObject, fetchFunction, "Preference removed\."\);/);
  assert.match(script, /status\.textContent = "Your preference could not be removed\. Please try again\.";/);
});

test("preference removal prevents duplicate requests and permits retry after failure", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removePreference\(preference\.preferenceId, remove\);/);
  assert.match(script, /async function \(preferenceId, button\) \{\s+button\.disabled = true;\s+status\.textContent = "Removing preference…";/);
  assert.match(script, /button\.disabled = false;\s+status\.textContent = "Your preference could not be removed\. Please try again\.";/);
});

test("preference save confirmation follows a successful list refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPreferences\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
  assert.match(script, /input\.value = "";\s+await loadPreferences\(documentObject, fetchFunction, "Preference saved\."\);/);
});

test("preference removal confirmation follows a successful list refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!removed\.ok\) throw new Error\("Removal failed"\);\s+await loadPreferences\(documentObject, fetchFunction, "Preference removed\."\);/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved possibility removal confirmation follows a successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPossibilities\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /await loadPossibilities\(documentObject, fetchFunction, "Saved possibility removed\."\);/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved intention removal confirmation follows a successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadIntentions\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /await loadIntentions\(documentObject, fetchFunction, "Saved intention removed\."\);/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved intention removal prevents duplicate clicks", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removeIntention\(intention\.intentionId, remove\);/);
  assert.match(script, /button\.disabled = true; status\.textContent = "Removing saved intention…";/);
  assert.match(script, /button\.disabled = false; status\.textContent = "The saved intention could not be removed\.";/);
});

test("saved possibility removal prevents duplicate clicks", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removePossibility\(possibility\.savedPossibilityId, remove\);/);
  assert.match(script, /button\.disabled = true; status\.textContent = "Removing saved possibility…";/);
  assert.match(script, /button\.disabled = false; status\.textContent = "The saved possibility could not be removed\.";/);
});

test("privacy save confirmation follows successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPrivacyControls\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /status\.textContent = successMessage \|\| "";/);
  assert.match(script, /await loadPrivacyControls\(documentObject, fetchFunction, "Privacy controls saved\."\);/);
});

test("preference mutation distinguishes successful write from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? "Your change was saved, but your preferences could not be refreshed\. Please refresh the page\." : "Your preferences could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;\s+return true;/);
});

test("intention removal distinguishes successful delete from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? "The saved intention was removed, but your intentions could not be refreshed\. Please refresh the page\." : "Your intentions could not be loaded\. Please refresh to try again\."/);
});

test("possibility removal distinguishes successful delete from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? "The saved possibility was removed, but your possibilities could not be refreshed\. Please refresh the page\." : "Your possibilities could not be loaded\. Please refresh to try again\."/);
});

test("privacy save distinguishes successful write from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? "Your privacy controls were saved, but could not be refreshed\. Please refresh the page before making further changes\." : "Your privacy controls could not be loaded\. Please refresh to try again\."/);
});

test("privacy controls reject malformed response before enabling save", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /typeof controls\.usePreferencesAsGuidance !== "boolean" \|\| typeof controls\.useFeedbackAsGuidance !== "boolean"/);
  assert.match(script, /Your privacy controls could not be verified\. Please refresh before making changes\./);
});

test("invalid preferences payload is not displayed as an empty saved list", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!result \|\| !Array\.isArray\(result\.preferences\)\)/);
  assert.match(script, /Your preferences could not be verified\. Please refresh the page\./);
});

test("customer continuation URLs reject embedded whitespace", function () {
  const script = read("js/customer.js");
  const functionSource = script.match(/function validatedCustomerWebUrl\(value\) \{[\s\S]*?\n\}/);
  assert.ok(functionSource);
  const normalizeSource = script.match(/function normalizedRequiredString\(value\) \{[\s\S]*?\n\}/);
  assert.ok(normalizeSource);
  const validate = new Function(normalizeSource[0] + "\n" + functionSource[0] + "\nreturn validatedCustomerWebUrl;")();
  assert.equal(validate("https://example.com/a b"), null);
  assert.equal(validate("https://example.com/a\tb"), null);
  assert.equal(validate("https://example.com/valid"), "https://example.com/valid");
});
