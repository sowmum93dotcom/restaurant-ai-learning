const { getCapabilityForRecommendationType } = require("./capability-registry.js");

const supportedCustomerExperienceCampaignTypes = Object.freeze(["full", "social", "email"]);
const fullCampaignCustomerSections = ["SOCIAL MEDIA POST", "SHORT AD COPY", "CALL TO ACTION"];

function getCustomerFacingContent(campaign) {
  if (!campaign || typeof campaign.campaignText !== "string" || !campaign.campaignText.trim()) return null;
  if (campaign.campaignType !== "full") return campaign.campaignText.trim();

  const headings = ["CAMPAIGN STRATEGY", "SOCIAL MEDIA POST", "EMAIL CAMPAIGN", "SHORT AD COPY", "CALL TO ACTION"];
  const headingPattern = new RegExp(`^[\\t ]*(${headings.join("|")})[\\t ]*\\r?$`, "gm");
  const matches = Array.from(campaign.campaignText.matchAll(headingPattern));
  if (matches.length !== headings.length || !matches.every(function (match, index) { return match[1] === headings[index]; })) {
    return null;
  }

  const sections = matches.map(function (match, index) {
    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : campaign.campaignText.length;
    return { heading: match[1], content: campaign.campaignText.slice(contentStart, contentEnd).trim() };
  });
  if (sections.some(function (section) { return !section.content; })) return null;

  return sections.filter(function (section) { return fullCampaignCustomerSections.includes(section.heading); })
    .map(function (section) { return section.content; }).join("\n\n");
}

function canPublishToDemeosCustomerExperience(campaign) {
  if (!campaign || campaign.approvalStatus !== "Approved") return false;
  if (!supportedCustomerExperienceCampaignTypes.includes(campaign.campaignType)) return false;

  const capability = getCapabilityForRecommendationType(campaign.campaignType);
  return Boolean(capability && capability.available && getCustomerFacingContent(campaign));
}

// Database keys remain authority. Optional embedded claims may corroborate
// them, but cannot contradict them or supply publication permission.
function inspectCustomerPublication(row) {
  const reasons = [];
  const text = value => typeof value === "string" && value.trim() ? value.trim() : null;
  const record = value => value && typeof value === "object" && !Array.isArray(value);
  const businessId = text(row && row.business_id), campaignId = text(row && row.campaign_id);
  const profile = row && row.profile, campaign = row && row.campaign;
  if (!businessId || !campaignId) reasons.push("missing_source_identity");
  if (!record(profile) || !text(profile.name)) reasons.push("missing_business_fields");
  if (record(profile) && Number(profile.profileVersion) >= 4 && profile.products !== undefined && !Array.isArray(profile.products)) reasons.push("offers_format_invalid");
  if (!canPublishToDemeosCustomerExperience(campaign)) reasons.push("publication_ineligible");
  if ((record(profile) && Object.hasOwn(profile, "businessId") && text(profile.businessId) !== businessId) ||
      (record(campaign) && Object.hasOwn(campaign, "businessId") && text(campaign.businessId) !== businessId) ||
      (record(campaign) && Object.hasOwn(campaign, "id") && text(campaign.id) !== campaignId)) reasons.push("source_identity_mismatch");
  if (record(profile) && profile.informationStatus !== undefined) {
    const status = profile.informationStatus;
    if (!record(status) || status.status !== "business-provided" ||
        (Object.hasOwn(status, "source") && status.source !== "business-owner") ||
        (Object.hasOwn(status, "ownerConfirmedAt") && (!text(status.ownerConfirmedAt) || !Number.isFinite(Date.parse(status.ownerConfirmedAt))))) reasons.push("information_provenance_invalid");
  }
  const eligible = reasons.length === 0;
  if (eligible) {
    if (!record(profile.informationStatus) || !text(profile.informationStatus.ownerConfirmedAt)) reasons.push("information_provenance_unverified");
    if (!text(profile.location)) reasons.push("location_unverified");
    const timestamp = value => value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
    const approved = timestamp(row.approved_at), updated = timestamp(row.campaign_updated_at);
    if (!Number.isFinite(approved) || !Number.isFinite(updated)) reasons.push("freshness_unverified");
    // approved_at records initial approval, including after withdrawal/reactivation.
    // Later updates cannot establish the effective current approval time.
    else if (updated > approved) reasons.push("freshness_unverified");
  }
  return {eligible, reasons};
}

module.exports = {
  canPublishToDemeosCustomerExperience,
  getCustomerFacingContent,
  inspectCustomerPublication
};
