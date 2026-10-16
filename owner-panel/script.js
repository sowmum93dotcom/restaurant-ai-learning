let currentEditId = null;

function populateNeighborhoodSelect() {
  const select = document.getElementById("neighborhood-input");
  NEIGHBORHOODS.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = n.name;
    select.appendChild(opt);
  });
}

function renderSearchResults(matches) {
  const container = document.getElementById("search-results");

  if (matches.length === 0) {
    container.innerHTML = `<p class="no-results">No matching listing found.</p>`;
    return;
  }

  container.innerHTML = matches
    .map(
      (l) => `
      <div class="match-card">
        <div>
          <strong>${l.name}</strong>
          <span class="badge ${l.verified ? "verified" : "unverified"}">
            ${l.verified ? "Verified" : "Unverified"}
          </span>
          <p class="match-meta">${l.category === "restaurant" ? "Restaurant" : "Retail"} &middot; ${
        NEIGHBORHOODS.find((n) => n.id === l.neighborhood)?.name || l.neighborhood
      }</p>
        </div>
        <button type="button" class="claim-btn" data-id="${l.id}">Claim &amp; edit</button>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".claim-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listing = loadListings().find((l) => l.id === btn.dataset.id);
      if (listing) openFormForEdit(listing);
    });
  });
}

function openFormForEdit(listing) {
  currentEditId = listing.id;
  document.getElementById("form-heading").textContent = `Step 2 — Edit "${listing.name}"`;
  document.getElementById("category-input").value = listing.category;
  document.getElementById("name-input").value = listing.name;
  document.getElementById("neighborhood-input").value = listing.neighborhood;
  document.getElementById("types-input").value = listing.types.join(", ");
  document.getElementById("tags-input").value = listing.tags.join(", ");
  document.getElementById("price-input").value = String(listing.priceTier);
  document.getElementById("open-input").value = listing.hours.open;
  document.getElementById("close-input").value = listing.hours.close;
  document.getElementById("highlight-input").value = listing.highlight || "";
  document.getElementById("confirm-checkbox").checked = false;
  showForm();
}

function openFormForNew() {
  currentEditId = null;
  document.getElementById("form-heading").textContent = "Step 2 — New listing details";
  document.getElementById("listing-form").reset();
  document.getElementById("price-input").value = "2";
  showForm();
}

function showForm() {
  const panel = document.getElementById("form-panel");
  panel.hidden = false;
  document.getElementById("form-message").hidden = true;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function splitList(value) {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

function handleSearch() {
  const query = document.getElementById("biz-search-input").value;
  renderSearchResults(findListingsByName(query));
}

function handleSubmit(event) {
  event.preventDefault();

  const patch = {
    category: document.getElementById("category-input").value,
    name: document.getElementById("name-input").value.trim(),
    neighborhood: document.getElementById("neighborhood-input").value,
    types: splitList(document.getElementById("types-input").value),
    tags: splitList(document.getElementById("tags-input").value),
    priceTier: Number(document.getElementById("price-input").value),
    hours: {
      open: document.getElementById("open-input").value,
      close: document.getElementById("close-input").value,
    },
    highlight: document.getElementById("highlight-input").value.trim(),
    verified: true,
    selfAttested: true,
  };

  const neighborhood = NEIGHBORHOODS.find((n) => n.id === patch.neighborhood);

  let saved;
  if (currentEditId) {
    saved = updateListing(currentEditId, patch);
  } else {
    saved = addListing({
      ...patch,
      coords: { x: neighborhood.x, y: neighborhood.y },
      rating: 0,
    });
    currentEditId = saved.id;
  }

  const message = document.getElementById("form-message");
  message.hidden = false;
  message.textContent = `Saved. "${saved.name}" is now marked verified (self-attested). You can search for it in the search demo, or an admin can review it in the admin panel.`;
}

document.addEventListener("DOMContentLoaded", () => {
  populateNeighborhoodSelect();
  document.getElementById("biz-search-btn").addEventListener("click", handleSearch);
  document.getElementById("add-new-btn").addEventListener("click", openFormForNew);
  document.getElementById("listing-form").addEventListener("submit", handleSubmit);
});
