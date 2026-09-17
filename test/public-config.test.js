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

test("missing publishable key fails safely with a non-secret diagnostic", function () {
  return withEnvironment({ CLERK_SECRET_KEY: "sk_test_secret", DATABASE_URL: "postgres://secret" }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
      error: "Authentication configuration is unavailable.",
      configurationStatus: "publishable-key-missing",
      diagnostic: {
        vercelEnvironment: "missing",
        clerkPublishableKey: "missing",
        nextPublicClerkPublishableKey: "missing"
      }
    });
    assert.doesNotMatch(JSON.stringify(res.body), /sk_test_secret|postgres|CLERK_SECRET_KEY/);
  });
});

test("production public config rejects a Clerk development publishable key", function () {
  return withEnvironment({
    VERCEL_ENV: "production",
    CLERK_PUBLISHABLE_KEY: "pk_test_public"
  }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
      error: "Authentication configuration is unavailable.",
      configurationStatus: "publishable-key-invalid",
      diagnostic: {
        vercelEnvironment: "production",
        clerkPublishableKey: "development-key",
        nextPublicClerkPublishableKey: "missing"
      }
    });
    assert.doesNotMatch(JSON.stringify(res.body), /pk_test_public/);
  });
});

test("production public config exposes a Clerk live publishable key", function () {
  return withEnvironment({
    VERCEL_ENV: "production",
    CLERK_PUBLISHABLE_KEY: "pk_live_public"
  }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clerkPublishableKey, "pk_live_public");
  });
});

test("production public config defers non-development publishable key validation to Clerk", function () {
  return withEnvironment({
    VERCEL_ENV: "production",
    CLERK_PUBLISHABLE_KEY: "provider_managed_public_value"
  }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clerkPublishableKey, "provider_managed_public_value");
  });
});

test("production public config supports Clerk's standard NEXT_PUBLIC publishable key alias", function () {
  return withEnvironment({
    VERCEL_ENV: "production",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_public"
  }, function () {
    const res = response();
    publicConfig({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clerkPublishableKey, "pk_live_public");
  });
});
