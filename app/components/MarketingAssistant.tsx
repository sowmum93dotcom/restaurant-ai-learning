"use client";

import { useState } from "react";

// Still a local placeholder, not a real AI call — matches the original
// MVP's "no real AI integration yet" scope. This stays true even now that
// search/owner/admin are wired to a real backend: this piece's job hasn't
// changed yet.
function buildSampleCampaign(promoText: string): string {
  return (
    "Social Media Post:\n" +
    `"${promoText} Come taste it for yourself — book your table today!"\n\n` +
    "Email Subject Line:\n" +
    "You won't want to miss this...\n\n" +
    "Short Ad Copy:\n" +
    `${promoText} Limited time only. Visit us or order online!\n\n` +
    "(This is a sample campaign generated from your description. " +
    "Real AI-generated content will be added in a future version.)"
  );
}

export default function MarketingAssistant() {
  const [promoText, setPromoText] = useState("");
  const [campaign, setCampaign] = useState<string | null>(null);

  function handleGenerate() {
    const trimmed = promoText.trim();
    if (!trimmed) {
      alert("Please describe what you'd like to promote first.");
      return;
    }
    setCampaign(buildSampleCampaign(trimmed));
  }

  return (
    <section className="panel">
      <h2>AI Marketing Assistant</h2>
      <p>
        Describe what you&apos;d like to promote (a new dish, a weekend
        special, a holiday event, etc.) and generate a starter marketing
        campaign.
      </p>

      <label htmlFor="promo-input">What would you like to promote?</label>
      <textarea
        id="promo-input"
        rows={5}
        value={promoText}
        onChange={(e) => setPromoText(e.target.value)}
        placeholder="Example: We're launching a new truffle pasta special every Friday night..."
      />

      <button className="block-button" type="button" onClick={handleGenerate}>
        Generate Marketing Campaign
      </button>

      {campaign && (
        <div className="success-message" style={{ whiteSpace: "pre-wrap" }}>
          <strong>Your Marketing Campaign</strong>
          <div style={{ marginTop: "0.5rem" }}>{campaign}</div>
        </div>
      )}
    </section>
  );
}
