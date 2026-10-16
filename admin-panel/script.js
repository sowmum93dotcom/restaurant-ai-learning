function renderStats(listings) {
  document.getElementById("stat-total").textContent = listings.length;
  document.getElementById("stat-verified").textContent = listings.filter((l) => l.verified).length;
  document.getElementById("stat-unverified").textContent = listings.filter((l) => !l.verified).length;
  document.getElementById("stat-restaurants").textContent = listings.filter(
    (l) => l.category === "restaurant"
  ).length;
  document.getElementById("stat-retail").textContent = listings.filter((l) => l.category === "retail").length;
}

function neighborhoodName(id) {
  return NEIGHBORHOODS.find((n) => n.id === id)?.name || id;
}

function renderTable() {
  const allListings = loadListings();
  renderStats(allListings);

  const search = document.getElementById("filter-search").value.trim().toLowerCase();
  const category = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;

  const filtered = allListings.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search)) return false;
    if (category !== "all" && l.category !== category) return false;
    if (status === "verified" && !l.verified) return false;
    if (status === "unverified" && l.verified) return false;
    return true;
  });

  const body = document.getElementById("listings-table-body");

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="no-rows">No listings match these filters.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map(
      (l) => `
      <tr>
        <td>
          <strong>${l.name}</strong>
          ${l.selfAttested ? '<div class="sub-note">self-attested by owner</div>' : ""}
        </td>
        <td>${l.category === "restaurant" ? "Restaurant" : "Retail"}</td>
        <td>${neighborhoodName(l.neighborhood)}</td>
        <td>${"$".repeat(l.priceTier)}</td>
        <td>
          <span class="badge ${l.verified ? "verified" : "unverified"}">
            ${l.verified ? "Verified" : "Unverified"}
          </span>
        </td>
        <td>${l.rating ? l.rating.toFixed(1) + "★" : "—"}</td>
        <td class="actions-cell">
          <button type="button" class="toggle-btn" data-id="${l.id}">
            ${l.verified ? "Unverify" : "Verify"}
          </button>
          <button type="button" class="delete-btn" data-id="${l.id}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");

  body.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listing = allListings.find((l) => l.id === btn.dataset.id);
      updateListing(btn.dataset.id, { verified: !listing.verified });
      renderTable();
    });
  });

  body.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteListing(btn.dataset.id);
      renderTable();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderTable();

  ["filter-search", "filter-category", "filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderTable);
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    resetListings();
    renderTable();
  });
});
