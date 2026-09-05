const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId].js");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    ended: false,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

function completeProfile(overrides) {
  return {
    name: "DEMEOS Kitchen",
    type: "Restaurant",
    location: "London",
    brandVoice: "Warm and welcoming",
    targetCustomer: "Local families",
    goal: "Increase reservations",
    ...overrides
  };
}

async function putProfile(businessId, businessProfile) {
  const savedProfiles = [];
  const originalGetRepository = require(persistencePath).getRepository;
  require(persistencePath).getRepository = function () {
    return {
      async saveBusiness(profile) {
        savedProfiles.push(profile);
      }
    };
  };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const response = createResponse();

  try {
    await handler({ method: "PUT", query: { businessId }, body: { businessProfile } }, response);
  } finally {
    require(persistencePath).getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }

  return { response, savedProfiles };
}

test("a complete Business Manager Profile is accepted", async function () {
  const profile = completeProfile();

  const result = await putProfile("business-a", profile);

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.response.ended, true);
  assert.deepEqual(result.savedProfiles, [{ ...profile, businessId: "business-a" }]);
});

test("a Business Manager Profile with a missing required field is rejected", async function () {
  const profile = completeProfile();
  delete profile.targetCustomer;

  const result = await putProfile("business-a", profile);

  assert.equal(result.response.statusCode, 400);
  assert.deepEqual(result.response.body, {
    error: "Please complete all Business Manager Profile fields before saving."
  });
  assert.deepEqual(result.savedProfiles, []);
});

test("a Business Manager Profile with a whitespace-only required field is rejected", async function () {
  const result = await putProfile("business-a", completeProfile({ brandVoice: " \n\t " }));

  assert.equal(result.response.statusCode, 400);
  assert.deepEqual(result.response.body, {
    error: "Please complete all Business Manager Profile fields before saving."
  });
  assert.deepEqual(result.savedProfiles, []);
});

test("the URL businessId remains authoritative", async function () {
  const result = await putProfile("url-business", completeProfile({ businessId: "body-business" }));

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.savedProfiles[0].businessId, "url-business");
});
