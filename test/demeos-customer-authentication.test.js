const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  resolveTrustedCustomerIdentityFromRequest
} = require("../api/_lib/demeos-customer-authentication.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../api/_lib/demeos-rules.js");
const {
  createAuthenticatedCustomerContext,
  createAuthenticatedBusinessOwnerContext,
  createAuthenticatedAdminContext,
  createPublicCustomerContext
} = require("../api/_lib/demeos-actor-context.js");
const { authorizeDemeosAction } = require("../api/_lib/demeos-authorization.js");

test("customer identity is derived only from the trusted provider result", async function () {
  const attackerRequest = {
    query: { customerId: "query-attacker" },
    body: { customerId: "body-attacker" },
    headers: { "x-customer-id": "header-attacker" },
    localStorage: { customerId: "browser-attacker" }
  };
  const identity = await resolveTrustedCustomerIdentityFromRequest(attackerRequest, {
    resolveTrustedIdentityFromRequest: async function (received) {
      assert.equal(received, attackerRequest);
      return { trustedIdentityId: "provider-verified", provider: "clerk" };
    }
  });

  assert.deepEqual(identity, {
    trustedCustomerIdentityId: "provider-verified",
    provider: "clerk"
  });
  assert.equal(Object.isFrozen(identity), true);
});

test("customer authentication is explicitly absent when provider verification fails", async function () {
  const identity = await resolveTrustedCustomerIdentityFromRequest({
    query: { customerId: "attacker" },
    body: { trustedCustomerIdentityId: "attacker" }
  }, { resolveTrustedIdentityFromRequest: async () => null });
  assert.equal(identity, null);
});

test("CUSTOMER has only its narrow profile permission and cannot use owner or admin actions", function () {
  const forbidden = [
    DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE,
    DEMEOS_ACTIONS.CREATE_MARKETING,
    DEMEOS_ACTIONS.APPROVE_OWN_MARKETING,
    DEMEOS_ACTIONS.RECORD_CAMPAIGN_OUTCOME,
    DEMEOS_ACTIONS.RECORD_RECOMMENDATION_DECISION,
    DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS,
    DEMEOS_ACTIONS.MANAGE_PLATFORM
  ];
  assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PROFILE }), true);
  for (const action of forbidden) {
    assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action }), false);
  }
});

test("authenticated CUSTOMER, owner, admin, and PUBLIC_CUSTOMER contexts remain separate", function () {
  const customer = createAuthenticatedCustomerContext({ trustedCustomerIdentityId: "customer-provider-id" });
  const owner = createAuthenticatedBusinessOwnerContext({ trustedIdentityId: "owner-provider-id", businessId: "business-a" });
  const admin = createAuthenticatedAdminContext({ trustedIdentityId: "admin-provider-id" });
  const publicCustomer = createPublicCustomerContext();

  assert.equal(authorizeDemeosAction({ actorContext: customer, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PROFILE }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: owner, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PROFILE, businessId: "business-a" }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: admin, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PROFILE }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PROFILE }).allowed, false);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer, action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer, action: DEMEOS_ACTIONS.RECORD_CUSTOMER_PARTICIPATION }).allowed, true);
  assert.equal(authorizeDemeosAction({ actorContext: publicCustomer, action: DEMEOS_ACTIONS.RECORD_CUSTOMER_FEEDBACK }).allowed, true);
});

test("customer browser authentication introduces no stored identity or anonymous linking", function () {
  const source = fs.readFileSync(require.resolve("../js/my-demeos.js"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|customerId|randomUUID|setItem|anonymous.*(?:migrate|link|inherit)/i);
  assert.doesNotMatch(source, /password|CLERK_SECRET_KEY|trustedCustomerIdentityId|trustedIdentityId|authorization/i);
});
