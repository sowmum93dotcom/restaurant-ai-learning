// --- This file simulates the pipeline we designed: ---
// 1. Query understanding (turn free text into structured filters)
// 2. Combine with location + user filters
// 3. Score & rank every restaurant, explain why it matched
//
// In a real system, step 1 would call an AI model (e.g. the Claude API)
// instead of this keyword matcher, and the data would come from a real
// database instead of the array in data.js.

const CUISINE_WORDS = [
  "italian", "pizza", "chinese", "japanese", "sushi", "mexican",
  "steak", "american", "indian", "vegan", "salad", "taco", "tacos",
];

const DIETARY_WORDS = ["vegan", "vegetarian", "gluten-free", "gluten free"];

const CHEAP_WORDS = ["cheap", "affordable", "budget", "inexpensive"];
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

  const cuisines = CUISINE_WORDS.filter((word) => lower.includes(word));
  const dietary = DIETARY_WORDS.filter((word) => lower.includes(word)).map(
    (w) => (w === "gluten free" ? "gluten-free" : w)
  );

  let priceTier = null;
  if (CHEAP_WORDS.some((w) => lower.includes(w))) priceTier = 1;
  if (UPSCALE_WORDS.some((w) => lower.includes(w))) priceTier = 3;

  const wantsOpenNow = lower.includes("open now") || lower.includes("open right now");

  return { rawText: text, cuisines, dietary, priceTier, wantsOpenNow };
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

// Step 3: score + rank each restaurant against the parsed query
function scoreRestaurant(restaurant, parsed, userCoords, verifiedOnly) {
  if (verifiedOnly && !restaurant.verified) return null;

  const openNow = computeOpenNow(restaurant.hours);
  if (parsed.wantsOpenNow && !openNow) return null; // hard filter

  let score = 0;
  const reasons = [];

  parsed.cuisines.forEach((c) => {
    if (restaurant.cuisines.includes(c)) {
      score += 3;
      reasons.push(`matches cuisine "${c}"`);
    }
  });

  parsed.dietary.forEach((d) => {
    if (restaurant.dietary.includes(d)) {
      score += 3;
      reasons.push(`matches dietary need "${d}"`);
    }
  });

  if (parsed.priceTier && restaurant.priceTier === parsed.priceTier) {
    score += 2;
    reasons.push("matches price range");
  }

  if (parsed.wantsOpenNow && openNow) {
    score += 2;
    reasons.push("open right now");
  }

  if (restaurant.verified) {
    score += 1;
    reasons.push("verified location");
  }

  score += restaurant.rating / 5; // small boost for higher-rated places

  const dist = distance(userCoords, restaurant.coords);
  score -= dist * 0.3; // closer restaurants rank slightly higher

  return { restaurant, score, reasons, openNow, distance: dist };
}

function renderParsed(parsed) {
  const panel = document.getElementById("parsed-panel");
  const content = document.getElementById("parsed-content");
  panel.hidden = false;

  const chip = (label) => `<span class="chip">${label}</span>`;

  content.innerHTML = `
    <p><strong>Cuisines detected:</strong> ${
      parsed.cuisines.length ? parsed.cuisines.map(chip).join(" ") : "none"
    }</p>
    <p><strong>Dietary needs detected:</strong> ${
      parsed.dietary.length ? parsed.dietary.map(chip).join(" ") : "none"
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
    list.innerHTML = `<p class="no-results">No restaurants matched those filters in the sample data.</p>`;
    return;
  }

  list.innerHTML = scored
    .map(
      (r) => `
      <div class="result-card">
        <div class="result-header">
          <h3>${r.restaurant.name}</h3>
          <span class="badge ${r.restaurant.verified ? "verified" : "unverified"}">
            ${r.restaurant.verified ? "Verified" : "Unverified"}
          </span>
        </div>
        <p class="result-meta">
          ${"$".repeat(r.restaurant.priceTier)} &middot;
          ${r.restaurant.cuisines.join(", ")} &middot;
          ${r.restaurant.rating.toFixed(1)}★ &middot;
          ${r.openNow ? "Open now" : "Closed now"} &middot;
          ${r.distance.toFixed(1)} mi away (demo units)
        </p>
        <p class="result-highlight">${r.restaurant.highlight}</p>
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

  const userNeighborhood = NEIGHBORHOODS.find((n) => n.id === neighborhoodId);
  const parsed = parseQuery(queryText);
  renderParsed(parsed);

  const scored = RESTAURANTS.map((r) =>
    scoreRestaurant(r, parsed, userNeighborhood, verifiedOnly)
  )
    .filter((r) => r !== null)
    .sort((a, b) => b.score - a.score);

  renderResults(scored);
}

document.addEventListener("DOMContentLoaded", () => {
  populateNeighborhoods();
  document.getElementById("search-btn").addEventListener("click", runSearch);
  runSearch(); // show an initial result set using the default query
});
