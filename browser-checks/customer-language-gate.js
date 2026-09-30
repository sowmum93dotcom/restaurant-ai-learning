const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto("http://127.0.0.1:4173/customer.html#discover", { waitUntil: "networkidle" });
      assert.ok((await page.locator("body").innerText()).trim().length > 100, "Customer Experience must render meaningful content");
      assert.equal(await page.locator("#customer-language").count(), 1, "Language selector must render");
      assert.deepEqual(await page.locator("#customer-language option").evaluateAll(options => options.map(o => o.value)), ["en","fr","ar"], "Public selector remains gated before final release");
      assert.ok(await page.locator(".customer-journey-nav").isVisible(), "Customer journey navigation must be visible");
      assert.equal(errors.length, 0, "Customer Experience must not raise page errors");
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
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
