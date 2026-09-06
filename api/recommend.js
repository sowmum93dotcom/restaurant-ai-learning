const requiredBusinessProfileFields = [
  "name", "type", "location", "brandVoice", "targetCustomer", "goal"
];
const campaignTypes = ["full", "social", "email"];

function validProfile(profile) {
  return profile !== null && typeof profile === "object" && !Array.isArray(profile) &&
    requiredBusinessProfileFields.every((field) => typeof profile[field] === "string" && profile[field].trim());
}

function parseRecommendations(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      !Array.isArray(parsed.recommendations) || parsed.recommendations.length !== 3) return null;
  const valid = parsed.recommendations.every((item) => item && typeof item === "object" && !Array.isArray(item) &&
    ["title", "reason", "suggestedRequest"].every((field) => typeof item[field] === "string" && item[field].trim()) &&
    campaignTypes.includes(item.suggestedCampaignType));
  return valid ? { recommendations: parsed.recommendations.map((item) => ({
    title: item.title.trim(), reason: item.reason.trim(), suggestedRequest: item.suggestedRequest.trim(),
    suggestedCampaignType: item.suggestedCampaignType
  })) } : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { businessProfile } = req.body || {};
  if (!validProfile(businessProfile)) {
    return res.status(400).json({ error: "Please complete and save the Business Manager Profile before requesting recommendations." });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service is not configured yet." });

  const profile = Object.fromEntries(requiredBusinessProfileFields.map((field) => [field, businessProfile[field].trim()]));
  const prompt = `You are the DEMEOS Marketing Agent. Recommend exactly THREE relevant marketing actions for the verified Business Manager Profile below.

Verified Business Manager Profile (the ONLY source of business facts):
Name: ${profile.name}
Business type: ${profile.type}
Location: ${profile.location}
Brand voice: ${profile.brandVoice}
Target customer: ${profile.targetCustomer}
Primary marketing goal: ${profile.goal}

Every recommendation must support the verified Primary marketing goal, suit the verified Target customer, and use the Brand voice only to guide tone. Work for the stated business type without restaurant-specific assumptions.
Ground recommendations ONLY in the verified profile. Do not invent or infer prices, discounts, opening hours, events, products, menu items, services, offers, customer statistics, performance statistics, booking levels, sales numbers, or business problems that were not provided. If a fact is not in the profile, omit it.

Return JSON only, with exactly this shape and no markdown:
{"recommendations":[{"title":"non-empty title","reason":"non-empty reason grounded in the profile","suggestedRequest":"non-empty marketing request","suggestedCampaignType":"full|social|email"}]}
The recommendations array must contain exactly three objects. Each object must contain title, reason, suggestedRequest, and suggestedCampaignType. suggestedCampaignType must be exactly full, social, or email.`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt })
    });
    const requestId = response.headers.get("x-request-id");
    const responseText = await response.text();
    let data;
    try { data = responseText ? JSON.parse(responseText) : {}; }
    catch (error) { return res.status(502).json({ error: "The AI service returned an unreadable response.", ...(requestId ? { requestId } : {}) }); }
    if (!response.ok) return res.status(502).json({ error: "The DEMEOS Marketing Agent could not create recommendations.", ...(requestId ? { requestId } : {}) });
    const output = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("").trim();
    const recommendations = parseRecommendations(output);
    if (!recommendations) return res.status(502).json({ error: "The DEMEOS Marketing Agent returned invalid recommendations.", ...(requestId ? { requestId } : {}) });
    return res.status(200).json(recommendations);
  } catch (error) {
    console.error("Recommendation server error:", error);
    return res.status(500).json({ error: "Something went wrong while creating recommendations." });
  }
}
