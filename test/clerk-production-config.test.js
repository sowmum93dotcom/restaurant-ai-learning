const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getAllowedClerkPublishableKey,
  getClerkConfigurationStatus,
  hasAllowedClerkPublishableKey,
  hasRequiredClerkConfiguration
} = require("../api/_lib/demeos-authentication.js");

test("production accepts the configured Clerk live publishable key", function () {
  const environment = {
    VERCEL_ENV: "production",
    CLERK_PUBLISHABLE_KEY: "  pk_live_public  ",
    CLERK_SECRET_KEY: "sk_live_secret"
  };
  assert.equal(getAllowedClerkPublishableKey(environment), "pk_live_public");
  assert.equal(hasAllowedClerkPublishableKey(environment), true);
  assert.equal(hasRequiredClerkConfiguration(environment), true);
  assert.equal(getClerkConfigurationStatus(environment), "ready");
});

test("production can use Clerk's standard browser-safe NEXT_PUBLIC alias", function () {
  const environment = {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_public",
    CLERK_SECRET_KEY: "sk_live_secret"
  };
  assert.equal(getAllowedClerkPublishableKey(environment), "pk_live_public");
  assert.equal(hasRequiredClerkConfiguration(environment), true);
  assert.equal(getClerkConfigurationStatus(environment), "ready");
});

test("production still rejects Clerk development keys", function () {
  const environment = {
    VERCEL_ENV: "production",
    CLERK_PUBLISHABLE_KEY: "pk_test_public",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_other",
    CLERK_SECRET_KEY: "sk_live_secret"
  };
  assert.equal(getAllowedClerkPublishableKey(environment), null);
  assert.equal(hasAllowedClerkPublishableKey(environment), false);
  assert.equal(hasRequiredClerkConfiguration(environment), false);
  assert.equal(getClerkConfigurationStatus(environment), "publishable-key-invalid");
});

test("configuration status distinguishes a missing publishable key without exposing values", function () {
  const environment = { VERCEL_ENV: "production", CLERK_SECRET_KEY: "sk_live_secret" };
  assert.equal(getClerkConfigurationStatus(environment), "publishable-key-missing");
  assert.equal(hasRequiredClerkConfiguration(environment), false);
});
