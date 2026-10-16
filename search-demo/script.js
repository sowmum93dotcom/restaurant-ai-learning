// --- This file simulates the pipeline we designed: ---
// 1. Query understanding (turn free text into structured filters)
// 2. Combine with location + user filters
// 3. Score & rank every listing, explain why it matched
//
// In a real system, step 1 would call an AI model (e.g. the Claude API)
// instead of this keyword matcher. Listings now come from the shared
// localStorage-backed data layer (shared/listings.js), so anything added
// or verified in the owner panel, or verified/removed in the admin panel,
// shows up here too.

const TYPE_WORDS = [
  "italian", "pizza", "chinese", "japanese", "sushi", "mexican",
  "steak", "american", "indian", "vegan", "salad", "taco", "tacos",
  "clothing", "grocery", "electronics", "bookstore", "gift shop",
  "pharmacy", "bakery",
];

const TAG_WORDS = [
  "vegan", "vegetarian", "gluten-free", "gluten free",
  "organic", "handmade", "eco-friendly", "discount", "imported",
];

const CHEAP_WORDS = ["cheap", "affordable", "budget", "inexpensive", "discount"];
const UPSCALE_WORDS = ["fancy", "upscale", "expensive", "fine dining"];

function populateNeighborhoods() {
  const select = document.getElementById("location-select");
  NEIGHBORHOODS.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = n.name;
    select.appendChild(opt);
  });
}

// Step 1: query understanding — turns free text into structured filters
function parseQuery(text) {
  const lower = text.toLowerCase();

  const types = TYPE_WORDS.filter((word) => lower.includes(word));
  const tags = TAG_WORDS.filter((word) => lower.includes(word)).map((w) =>
    w === "gluten free" ? "gluten-free" : w
  );

  let priceTier = null;
  if (CHEAP_WORDS.some((w) => lower.includes(w))) priceTier = 1;
  if (UPSCALE_WORDS.some((w) => lower.includes(w))) priceTier = 3;

  const wantsOpenNow = lower.includes("open now") || lower.includes("open right now");

  return { rawText: text, types, tags, priceTier, wantsOpenNow };
}

function computeOpenNow(hours) {
  const now = new Date();
  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Step 3: score + rank each listing against the parsed query
function scoreListing(listing, parsed, userCoords, verifiedOnly, category) {
  if (verifiedOnly && !listing.verified) return null;
  if (category !== "all" && listing.category !== category) return null;

  const openNow = computeOpenNow(listing.hours);
  if (parsed.wantsOpenNow && !openNow) return null; // hard filter

  let score = 0;
  const reasons = [];

  parsed.types.forEach((t) => {
    if (listing.types.includes(t)) {
      score += 3;
      reasons.push(`matches "${t}"`);
    }
  });

  parsed.tags.forEach((t) => {
    if (listing.tags.includes(t)) {
      score += 3;
      reasons.push(`matches "${t}"`);
    }
  });

  if (parsed.priceTier && listing.priceTier === parsed.priceTier) {
    score += 2;
    reasons.push("matches price range");
  }

  if (parsed.wantsOpenNow && openNow) {
    score += 2;
    reasons.push("open right now");
  }

  if (listing.verified) {
    score += 1;
    reasons.push("verified location");
  }

  score += listing.rating / 5; // small boost for higher-rated places

  const dist = distance(userCoords, listing.coords);
  score -= dist * 0.3; // closer listings rank slightly higher

  return { listing, score, reasons, openNow, distance: dist };
}

function renderParsed(parsed) {
  const panel = document.getElementById("parsed-panel");
  const content = document.getElementById("parsed-content");
  panel.hidden = false;

  const chip = (label) => `<span class="chip">${label}</span>`;

  content.innerHTML = `
    <p><strong>Types detected:</strong> ${
      parsed.types.length ? parsed.types.map(chip).join(" ") : "none"
    }</p>
    <p><strong>Tags detected:</strong> ${
      parsed.tags.length ? parsed.tags.map(chip).join(" ") : "none"
    }</p>
    <p><strong>Price preference:</strong> ${
      parsed.priceTier ? chip("$".repeat(parsed.priceTier)) : "none detected"
    }</p>
    <p><strong>"Open now" requested:</strong> ${parsed.wantsOpenNow ? chip("yes") : "no"}</p>
  `;
}

function renderResults(scored) {
  const panel = document.getElementById("results-panel");
  const list = document.getElementById("results-list");
  panel.hidden = false;

  if (scored.length === 0) {
    list.innerHTML = `<p class="no-results">No listings matched those filters in the sample data.</p>`;
    return;
  }

  list.innerHTML = scored
    .map(
      (r) => `
      <div class="result-card">
        <div class="result-header">
          <h3>${r.listing.name}</h3>
          <span class="badge ${r.listing.verified ? "verified" : "unverified"}">
            ${r.listing.verified ? "Verified" : "Unverified"}
          </span>
        </div>
        <p class="result-meta">
          ${r.listing.category === "restaurant" ? "Restaurant" : "Retail"} &middot;
          ${"$".repeat(r.listing.priceTier)} &middot;
          ${r.listing.types.join(", ")} &middot;
          ${r.listing.rating.toFixed(1)}★ &middot;
          ${r.openNow ? "Open now" : "Closed now"} &middot;
          ${r.distance.toFixed(1)} mi away (demo units)
        </p>
        <p class="result-highlight">${r.listing.highlight}</p>
        <p class="result-reasons">Why it matched: ${r.reasons.join(", ") || "general relevance"}</p>
      </div>
    `
    )
    .join("");
}

function runSearch() {
  const queryText = document.getElementById("query-input").value;
  const neighborhoodId = document.getElementById("location-select").value;
  const verifiedOnly = document.getElementById("filter-verified").checked;
  const category = document.getElementById("category-select").value;

  const userNeighborhood = NEIGHBORHOODS.find((n) => n.id === neighborhoodId);
  const parsed = parseQuery(queryText);
  renderParsed(parsed);

  const listings = loadListings();
  const scored = listings
    .map((l) => scoreListing(l, parsed, userNeighborhood, verifiedOnly, category))
    .filter((r) => r !== null)
    .sort((a, b) => b.score - a.score);

  renderResults(scored);
}

document.addEventListener("DOMContentLoaded", () => {
  populateNeighborhoods();
  document.getElementById("search-btn").addEventListener("click", runSearch);
  runSearch(); // show an initial result set using the default query
});
