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

module.exports = {
  canPublishToDemeosCustomerExperience,
  getCustomerFacingContent
};
