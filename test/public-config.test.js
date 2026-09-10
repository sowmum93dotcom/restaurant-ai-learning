const assert = require("node:assert/strict");
const test = require("node:test");

const publicConfig = require("../api/public-config.js");

function response() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function withEnvironment(values, callback) {
  const original = { ...process.env };
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, values);
  try { return await callback(); } finally {
    Object.keys(process.env).forEach((key) => delete process.env[key]);
    Object.assign(process.env, original);
  }
}

test("public config exposes only browser-safe Clerk and diagnostic configuration", function () {
  return withEnvironment({ CLERK_PUBLISHABLE_KEY: "pk_test_public", CLERK_SECRET_KEY: "sk_test_secret" }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      clerkPublishableKey: "pk_test_public",
      businessIdDiagnosticEnabled: false
    });
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(JSON.stringify(res.body), /sk_test_secret|CLERK_SECRET_KEY/);
  });
});

test("public config enables the business ID diagnostic only for exact true", function () {
  return withEnvironment({
    CLERK_PUBLISHABLE_KEY: "pk_test_public",
    DEMEOS_BUSINESS_ID_DIAGNOSTIC_ENABLED: "true"
  }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.businessIdDiagnosticEnabled, true);
  });
});

test("missing publishable key fails safely without leaking other configuration", function () {
  return withEnvironment({ CLERK_SECRET_KEY: "sk_test_secret", DATABASE_URL: "postgres://secret" }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: "Authentication configuration is unavailable." });
    assert.doesNotMatch(JSON.stringify(res.body), /sk_test_secret|postgres|CLERK_SECRET_KEY/);
  });
});
