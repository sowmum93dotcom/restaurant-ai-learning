const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8")
  .replace("export default async function handler", "module.exports = async function handler");
const profile = { name: "North Star", type: "Consultancy", location: "Leeds", brandVoice: "Clear and calm",
  targetCustomer: "Local small businesses", goal: "Build awareness" };
const valid = { recommendations: ["One", "Two", "Three"].map((title, index) => ({ title, reason: `Reason ${index}`,
  suggestedRequest: `Request ${index}`, suggestedCampaignType: ["full", "social", "email"][index] })) };

async function call(businessProfile = profile, output = JSON.stringify(valid)) {
  let fetchCalls = 0; let requestBody;
  const context = { module: { exports: {} }, process: { env: { OPENAI_API_KEY: "key" } }, console,
    fetch: async (url, options) => { fetchCalls += 1; requestBody = JSON.parse(options.body); return { ok: true,
      headers: { get() { return null; } }, async text() { return JSON.stringify({ output_text: output }); } }; } };
  vm.runInNewContext(source, context);
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await context.module.exports({ method: "POST", body: { businessProfile } }, response);
  return { response, fetchCalls, requestBody };
}

test("a complete Business Manager Profile is accepted", async () => {
  const result = await call(); assert.equal(result.response.statusCode, 200); assert.equal(result.fetchCalls, 1);
  assert.equal(result.response.body.recommendations.length, 3);
});

test("an incomplete profile is rejected before OpenAI", async () => {
  const result = await call({ ...profile, goal: undefined }); assert.equal(result.response.statusCode, 400); assert.equal(result.fetchCalls, 0);
});

test("whitespace-only profile fields are rejected", async () => {
  const result = await call({ ...profile, targetCustomer: " \n " }); assert.equal(result.response.statusCode, 400); assert.equal(result.fetchCalls, 0);
});

test("exactly three recommendations are required", async () => {
  const result = await call(profile, JSON.stringify({ recommendations: valid.recommendations.slice(0, 2) })); assert.equal(result.response.statusCode, 502);
});

for (const field of ["title", "reason", "suggestedRequest"]) test(`each recommendation requires ${field}`, async () => {
  const malformed = structuredClone(valid); delete malformed.recommendations[0][field];
  const result = await call(profile, JSON.stringify(malformed)); assert.equal(result.response.statusCode, 502);
});

test("suggestedCampaignType is limited to full, social, or email", async () => {
  const malformed = structuredClone(valid); malformed.recommendations[1].suggestedCampaignType = "video";
  const result = await call(profile, JSON.stringify(malformed)); assert.equal(result.response.statusCode, 502);
});

test("malformed AI output is rejected", async () => {
  const result = await call(profile, "not JSON"); assert.equal(result.response.statusCode, 502);
});

test("the prompt limits recommendations to campaign types the application can create", async () => {
  const result = await call(); const prompt = result.requestBody.input;
  for (const supported of ["Full Marketing Campaign (full)", "Social Media Post/Campaign (social)", "Email Campaign (email)"])
    assert.match(prompt, new RegExp(supported.replace(/[()]/g, "\\$&")));
  assert.match(prompt, /directly executable/);
  for (const unsupported of ["video production", "loyalty programmes", "paid advertising", "automatic publishing", "SMS",
    "websites", "events", "partnerships", "customer testimonial programmes", "booking systems", "CRM programmes"])
    assert.match(prompt, new RegExp(unsupported));
  assert.match(prompt, /Do not recommend or imply/);
});

test("the prompt grounds recommendations and suggested requests in verified facts only", async () => {
  const result = await call(); const prompt = result.requestBody.input;
  for (const value of Object.values(profile)) assert.match(prompt, new RegExp(value));
  assert.match(prompt, /ONLY source of business facts/);
  assert.match(prompt, /facts explicitly supplied/);
  for (const forbidden of ["offer", "discount", "promotion", "product or menu item", "service", "event", "loyalty programme",
    "testimonial", "partnership", "customer list", "performance result", "booking level", "sales figure", "opening hour",
    "other business asset or fact"]) assert.match(prompt, new RegExp(forbidden));
  assert.match(prompt, /each suggestedRequest must contain only verified profile facts plus safe instructions/);
  assert.match(prompt, /Never present an unsupported or unverified detail as an example, possibility, or proposed premise/);
});
