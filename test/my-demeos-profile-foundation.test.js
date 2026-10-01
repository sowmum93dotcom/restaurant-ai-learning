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
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = root\.DEMEOSMyPossibilitiesLanguage/);
  assert.match(script, /status\.textContent = "";\s+let result;/);
});

test("saved intentions failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /loading\.hidden = true;\s+status\.textContent = successMessage/);
});

test("participation load failure is announced and can be retried", function () {
  const script = read("js/my-demeos.js");
  const html = read("my-demeos.html");
  assert.match(script, /loading\.textContent = root\.DEMEOSMyParticipationLanguage/);
  assert.match(script, /loading\.textContent = root\.DEMEOSMyParticipationLanguage[\s\S]*?loading\.hidden = false;/);
  assert.match(html, /id="my-participation-loading" role="status" aria-live="polite"/);
});

test("preferences load failure replaces loading with recoverable message", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /"Your preferences could not be loaded\. Please refresh to try again\."/);
  assert.match(script, /loading\.textContent = root\.DEMEOSMyPreferencesLanguage[\s\S]*?loading\.hidden = false;/);
});

test("privacy controls cannot be saved when existing settings fail to load", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = successMessage \? \(root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(1\)[\s\S]*?: \(root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(2\)[\s\S]*?return;/);
  assert.match(script, /if \(submit\) submit\.disabled = true;\s+status\.textContent = root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(0\)/);
  assert.match(script, /if \(response\.ok\) await loadPrivacyControls\(documentObject, fetchFunction, root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(6\)[\s\S]*?else status\.textContent = root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(7\)[\s\S]*?if \(!response\.ok && submit\) submit\.disabled = false;/);
});

test("privacy controls save recovers from a network failure", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(5\)[\s\S]*?if \(submit\) submit\.disabled = false;\s+return;/);
  assert.match(script, /if \(response\.ok\) await loadPrivacyControls\(documentObject, fetchFunction, root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(6\)[\s\S]*?else status\.textContent = root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(7\)[\s\S]*?if \(!response\.ok && submit\) submit\.disabled = false;/);
});

test("preference creation recovers from a network failure without clearing input", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /status\.textContent = root\.DEMEOSMyPreferencesLanguage[\s\S]*?if \(submit\) submit\.disabled = false;\s+return;/);
  assert.match(script, /if \(!response\.ok\) \{ status\.textContent = root\.DEMEOSMyPreferencesLanguage[\s\S]*?submit\.disabled = false; return; \}/);
});

test("preference removal reports failed requests without removing the displayed item", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!removed\.ok\) throw new Error\("Removal failed"\);\s+await loadPreferences\(documentObject, fetchFunction, root\.DEMEOSMyPreferencesLanguage/);
  assert.match(script, /status\.textContent = root\.DEMEOSMyPreferencesLanguage \? root\.DEMEOSMyPreferencesLanguage\.text\(9\)/);
});

test("preference removal prevents duplicate requests and permits retry after failure", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removePreference\(preference\.preferenceId, remove\);/);
  assert.match(script, /async function \(preferenceId, button\) \{\s+button\.disabled = true;\s+status\.textContent = root\.DEMEOSMyPreferencesLanguage/);
  assert.match(script, /button\.disabled = false;\s+status\.textContent = root\.DEMEOSMyPreferencesLanguage/);
});

test("preference save confirmation follows a successful list refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPreferences\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
  assert.match(script, /input\.value = "";\s+await loadPreferences\(documentObject, fetchFunction, root\.DEMEOSMyPreferencesLanguage/);
});

test("preference removal confirmation follows a successful list refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!removed\.ok\) throw new Error\("Removal failed"\);\s+await loadPreferences\(documentObject, fetchFunction, root\.DEMEOSMyPreferencesLanguage/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved possibility removal confirmation follows a successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPossibilities\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /await loadPossibilities\(documentObject, fetchFunction, root\.DEMEOSMyPossibilitiesLanguage/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved intention removal confirmation follows a successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadIntentions\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /await loadIntentions\(documentObject, fetchFunction,/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;/);
});

test("saved intention removal prevents duplicate clicks", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removeIntention\(intention\.intentionId, remove\);/);
  assert.match(script, /button\.disabled = true; status\.textContent =/);
  assert.match(script, /button\.disabled = false; status\.textContent =/);
});

test("saved possibility removal prevents duplicate clicks", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!remove\.disabled\) removePossibility\(possibility\.savedPossibilityId, remove\);/);
  assert.match(script, /button\.disabled = true; status\.textContent = root\.DEMEOSMyPossibilitiesLanguage/);
  assert.match(script, /button\.disabled = false; status\.textContent = root\.DEMEOSMyPossibilitiesLanguage/);
});

test("privacy save confirmation follows successful refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /async function loadPrivacyControls\(documentObject, fetchFunction, successMessage\)/);
  assert.match(script, /status\.textContent = successMessage \|\| "";/);
  assert.match(script, /await loadPrivacyControls\(documentObject, fetchFunction, root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(6\)/);
});

test("preference mutation distinguishes successful write from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? \(root\.DEMEOSMyPreferencesLanguage[\s\S]*?text\(3\)[\s\S]*?:[\s\S]*?text\(4\)/);
  assert.match(script, /if \(successMessage\) status\.textContent = successMessage;\s+return true;/);
});

test("intention removal distinguishes successful delete from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \?/);
});

test("possibility removal distinguishes successful delete from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? "The saved possibility was removed, but your possibilities could not be refreshed\. Please refresh the page\." : "Your possibilities could not be loaded\. Please refresh to try again\."/);
});

test("privacy save distinguishes successful write from failed refresh", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? \(root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(1\)[\s\S]*?: \(root\.DEMEOSPrivacyControlLanguage[\s\S]*?text\(2\)/);
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

test("invalid intentions payload does not erase the saved intentions view", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!result \|\| !Array\.isArray\(result\.intentions\)\)/);
  assert.match(script, /Your intentions could not be verified\. Please refresh the page\./);
  assert.match(script, /The saved intention was removed, but your intentions could not be verified\. Please refresh the page\./);
  assert.match(script, /renderIntentions\(documentObject, result\.intentions,/);
});

test("invalid possibilities payload does not erase the saved possibilities view", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!result \|\| !Array\.isArray\(result\.possibilities\)\)/);
  assert.match(script, /Your possibilities could not be verified\. Please refresh the page\./);
  assert.match(script, /The saved possibility was removed, but your possibilities could not be verified\. Please refresh the page\./);
  assert.match(script, /renderPossibilities\(documentObject, result\.possibilities,/);
});

test("invalid participation payload is not displayed as an empty history", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /if \(!result \|\| !Array\.isArray\(result\.participations\)\)/);
  assert.match(script, /Your participation could not be verified\. Please refresh the page\./);
  assert.match(script, /renderParticipations\(documentObject, result\.participations\)/);
});

test("invalid preferences refresh preserves confirmation that a change was saved", function () {
  const script = read("js/my-demeos.js");
  assert.match(script, /successMessage \? \(root\.DEMEOSMyPreferencesLanguage[\s\S]*?text\(5\)[\s\S]*?:[\s\S]*?text\(6\)/);
});

test("normal Discover rejects a controlled test feed response", function () {
  const script = read("js/customer.js");
  assert.match(script, /\(!request\.testMode && data\.testMode === true\)/);
  assert.match(script, /\(request\.testMode && data\.testMode !== true\)/);
  assert.match(script, /CONTROLLED TEST CONTENT — not live business content/);
});

test("normal Discover returns only published work and an honest empty state", function () {
  const api = read("api/customer/work.js");
  assert.match(api, /if \(isDiscoverTestMode\(req\)\) \{[\s\S]*?work: getValidPublicCustomerWork\(discoverTestContent\(req\)\),[\s\S]*?testMode: true/);
  assert.match(api, /work: publicWork,\s+testMode: false/);
  assert.doesNotMatch(api, /work: useSamples \?/);
  const customer = read("js/customer.js");
  assert.match(customer, /Nothing to discover just yet/);
});

test("My DEMEOS preference input uses iPhone-safe text size without disabling zoom", function () {
  const css = read("css/demeos-customer-space.css");
  assert.match(css, /\.my-preferences-form input\{[^}]*font-size:16px\}/);
  const html = read("my-demeos.html");
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0"/);
});

test("no-match guidance has readable text on its pale panel", function () {
  const css = read("css/customer-mobile-refinement.css");
  assert.match(css, /\.customer-body \.customer-no-possibilities > p\.customer-no-match-guidance \{[^}]*background:#f4f7fb;color:#26384e/);
});


test("confirmed intention keeps explicit save available when identity check is unavailable", function () {
  const script = read("js/customer.js");
  assert.match(script, /saveArea\.hidden = false;/);
  assert.doesNotMatch(script, /saveArea\.hidden = identity\.authenticated !== true/);
  assert.match(script, /Please sign in to My DEMEOS before saving this intention/);
  assert.match(script, /Your intention could not be saved\. Please try again/);
});


test("My Participation guidance has readable dark text on its pale panel", function () {
  const html = read("my-demeos.html");
  const css = read("css/my-demeos-simple.css");
  assert.match(html, /class="my-demeos-meaning"/);
  assert.match(css, /\.my-demeos-body \.my-demeos-relationship-view p\.my-demeos-meaning\{color:#263a53\}/);
});


test("Discover images open for viewing without inventing product continuation", function () {
  const script = read("js/customer.js");
  const css = read("css/customer-mobile-refinement.css");
  assert.match(script, /if \(asset\.kind === "image"\) \{[\s\S]*?mediaLink\.href = asset\.deliveryUrl;[\s\S]*?mediaLink\.target = "_blank";/);
  assert.match(script, /mediaLink\.setAttribute\("aria-label", "Open full image " \+ \(mediaIndex \+ 1\) \+ " of " \+ work\.media\.length \+ " from " \+ work\.businessName \+ " \(opens in a new tab\)"\)/);
  assert.doesNotMatch(script, /mediaLink\.href = mediaHref;/);
  assert.match(css, /customer-work-media-link > img\.customer-work-media-item\{[^}]*object-fit:contain/);
});


test("Discover tablet images use full width and natural uncropped height", function () {
  const css = read("css/customer-mobile-refinement.css");
  assert.match(css, /@media\(min-width:681px\) and \(max-width:1180px\)\{\s*\.customer-body #discover \.customer-work-card \.customer-work-media > \.customer-work-media-link\{height:auto;aspect-ratio:auto\}/);
  assert.match(css, /customer-work-media-link > img\.customer-work-media-item\{width:100%;height:auto;max-height:none;aspect-ratio:auto;object-fit:contain\}/);
  assert.match(css, /@media\(max-width:680px\)\{\s*\.customer-body #discover \.customer-work-card \.customer-work-media > \.customer-work-media-link\{height:auto;aspect-ratio:auto\}/);
});


test("Mobile Discover keeps media, controls, description and business identity close together", function () {
  const css = read("css/customer-mobile-refinement.css");
  assert.match(css, /@media\(max-width:680px\)\{[\s\S]*?customer-work-card \.customer-work-media\{order:1;margin:0;padding:0\}/);
  assert.match(css, /customer-work-card \.customer-media-position\{order:2;margin:7px 0 0\}/);
  assert.match(css, /customer-work-card \.customer-media-controls\{order:3;margin:4px 0 0\}/);
  assert.match(css, /customer-work-card \.customer-work-content\{order:4;margin:8px 0 0;padding:0\}/);
  assert.match(css, /customer-work-card \.customer-work-context\{margin:8px 0 0;padding:4px 12px 8px\}/);
});


test("Mobile Discover images fill width without fixed-height side bars", function () {
  const css = read("css/customer-mobile-refinement.css");
  assert.match(css, /@media\(max-width:680px\)\{\s*\.customer-body #discover \.customer-work-card \.customer-work-media > \.customer-work-media-link\{height:auto;aspect-ratio:auto\}/);
  assert.match(css, /customer-work-media-link > img\.customer-work-media-item\{width:100%;height:auto;max-height:none;aspect-ratio:auto;object-fit:contain\}/);
  assert.match(css, /customer-work-context>div\{grid-column:1;grid-row:1\}/);
  assert.match(css, /customer-discover-position\{grid-column:2;grid-row:1;align-self:start;margin:0\}/);
});


test("Discover pauses videos when their media or business leaves view", function () {
  const script = read("js/customer.js");
  assert.match(script, /mediaRegion\.addEventListener\("scroll",[\s\S]*?video\.pause\(\)/);
  assert.match(script, /new IntersectionObserver\(function \(entries\)/);
  assert.match(script, /if \(!entry\.isIntersecting\) entry\.target\.querySelectorAll\("video"\)\.forEach\(function \(video\) \{ video\.pause\(\); \}\)/);
});


test("Discover videos pause when customer leaves Discover or browser page", function () {
  const script = read("js/customer.js");
  assert.match(script, /function pauseDiscoverVideos\(document\) \{[\s\S]*?discover\.querySelectorAll\("video"\)\.forEach\(function \(video\) \{ video\.pause\(\); \}\)/);
  assert.match(script, /if \(showIntention\) pauseDiscoverVideos\(document\);/);
  assert.match(script, /document\.addEventListener\("visibilitychange", function \(\) \{ if \(document\.hidden\) pauseDiscoverVideos\(document\); \}\)/);
  assert.match(script, /window\.addEventListener\("pagehide", function \(\) \{ pauseDiscoverVideos\(document\); \}\)/);
});


test("Discover refresh disconnects old media observer and pauses replaced videos", function () {
  const script = read("js/customer.js");
  assert.match(script, /const discoverMediaObservers = new WeakMap\(\)/);
  assert.match(script, /if \(previousObserver\) \{ previousObserver\.disconnect\(\); discoverMediaObservers\.delete\(list\); \}/);
  assert.match(script, /list\.querySelectorAll\("video"\)\.forEach\(function \(video\) \{ video\.pause\(\); \}\)/);
  assert.match(script, /discoverMediaObservers\.set\(list, observer\)/);
});


test("Discover arrow and keyboard navigation pause videos before scrolling", function () {
  const script = read("js/customer.js");
  assert.match(script, /if \(target\) \{\s*if \(target !== items\[closest\]\) pauseMediaVideos\(\);[\s\S]*?mediaRegion\.scrollBy/);
  assert.match(script, /mediaRegion\.querySelectorAll\("video"\)\.forEach\(function \(video\) \{ video\.pause\(\); \}\);\s*mediaRegion\.scrollBy/);
});
