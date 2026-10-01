const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", error => errors.push(String(error && error.stack ? error.stack : error)));
      await page.goto("http://127.0.0.1:4173/customer.html#discover", { waitUntil: "networkidle" });
      assert.ok((await page.locator("body").innerText()).trim().length > 100, "Customer Experience must render meaningful content");
      assert.equal(await page.locator("#customer-language").count(), 1, "Language selector must render");
      assert.deepEqual(await page.locator("#customer-language option").evaluateAll(options => options.map(o => o.value)), ["en","es","fr","ar","pt","zh","hi","de","ja"], "All verified languages must be publicly selectable");
      assert.ok(await page.locator(".customer-journey-nav").isVisible(), "Customer journey navigation must be visible");
      assert.equal(errors.length, 0, "Customer Experience must not raise page errors. " + errors.join(" | "));
      await page.close();
    }

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://127.0.0.1:4173/customer.html#discover", { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const languages = ["es","pt","zh","hi","de","ja"];
      return languages.map(code => {
        const applied = window.DEMEOSCustomerInterfaceLanguage ? window.DEMEOSCustomerInterfaceLanguage.apply(code) : null;
        return { code, applied, lang: document.documentElement.lang, dir: document.documentElement.dir,
          label: document.getElementById("customer-language-label").textContent };
      });
    });
    for (const state of result) {
      assert.equal(state.applied, state.code);
      assert.equal(state.lang, state.code);
      assert.equal(state.dir, "ltr");
      assert.ok(state.label.trim().length > 0);
    }
    await page.evaluate(() => window.DEMEOSCustomerInterfaceLanguage.apply("ar"));
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl", "Arabic must switch the document to RTL");
    assert.equal(await page.locator("html").getAttribute("lang"), "ar");
    await page.evaluate(() => window.DEMEOSCustomerInterfaceLanguage.apply("ja"));
    assert.equal(await page.locator("html").getAttribute("dir"), "ltr", "Japanese must restore LTR");
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    await page.close();
    // Exercise the real customer renderer with controlled, supplied media on all device sizes.
    const { getValidPublicCustomerWork } = require("../api/_lib/customer-public-work-contract.js");
    const { productExperienceTestContent } = require("../api/_lib/controlled-customer-test-content.js");
    const path = require("node:path");
    for (const viewport of [{ width:390, height:844 }, { width:820, height:1180 }, { width:1280, height:900 }]) {
      const testPage = await browser.newPage({ viewport });
      const errors = [];
      testPage.on("pageerror", error => errors.push(String(error)));
      await testPage.route("**/api/customer/work?demeos-test=1", async route => {
        assert.equal(route.request().headers()["x-demeos-test-mode"], "controlled-preview");
        await route.fulfill({ json: { work:getValidPublicCustomerWork(productExperienceTestContent()), customerPackages:[], testMode:true } });
      });
      await testPage.route("https://www.demeos.io/images/discover-test-*.jpg", route => route.fulfill({ path:path.join(__dirname,"..",new URL(route.request().url()).pathname) }));
      await testPage.route("https://www.demeos.io/media/controlled/*.mp4", route => route.fulfill({ path:path.join(__dirname,"..",new URL(route.request().url()).pathname), contentType:"video/mp4" }));
      await testPage.goto("http://127.0.0.1:4173/customer.html?demeos-test=1#discover", { waitUntil:"networkidle" });
      assert.equal(await testPage.locator(".customer-work-card").count(), 5);
      assert.match(await testPage.locator("#customer-work-status").innerText(), /CONTROLLED TEST CONTENT/);
      await testPage.locator(".customer-discover-option a").first().click();
      assert.ok(await testPage.locator("#product-experience").isVisible());
      assert.equal(await testPage.locator("#product-experience-title").innerText(), "Test navy outfit");
      assert.match(await testPage.locator("#product-experience-image").getAttribute("src"), /discover-test-fashion-navy.jpg$/);
      assert.ok(await testPage.locator("#product-experience-image").evaluate(img => img.complete && img.naturalWidth > 0));
      assert.equal(await testPage.locator("#product-experience-action").innerText(), "Where to buy");
      assert.equal(await testPage.locator("#product-experience-action").getAttribute("data-demeos-purchase"), null);
      await testPage.locator("#product-experience-back").click();
      assert.ok(await testPage.locator("#discover").isVisible());
      const video = testPage.locator("#discover video");
      await video.evaluate(v => { v.scrollIntoView(); v.muted = true; return v.play(); });
      assert.ok(await video.evaluate(v => v.videoWidth > 0 && v.currentSrc.endsWith("customer-outdoor-video.mp4")));
      await testPage.locator(".customer-discover-option a").first().click();
      assert.ok(await video.evaluate(v => v.paused));
      assert.ok(await testPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      assert.deepEqual(errors, []);
      await testPage.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
