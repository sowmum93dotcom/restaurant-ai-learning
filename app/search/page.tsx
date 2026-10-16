"use client";

import { useEffect, useState } from "react";

type Neighborhood = { id: string; name: string };

type ParsedQuery = {
  types: string[];
  tags: string[];
  priceTier: number | null;
  wantsOpenNow: boolean;
};

type ScoredListing = {
  listing: {
    id: string;
    name: string;
    category: string;
    priceTier: number;
    types: string[];
    rating: number;
    verified: boolean;
    highlight: string;
    neighborhoodName: string;
  };
  reasons: string[];
  openNow: boolean;
  distance: number;
};

const NEIGHBORHOODS: Neighborhood[] = [
  { id: "downtown", name: "Downtown" },
  { id: "riverside", name: "Riverside" },
  { id: "hillcrest", name: "Hillcrest" },
  { id: "old-town", name: "Old Town" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("affordable vegan pizza open now");
  const [neighborhoodId, setNeighborhoodId] = useState("downtown");
  const [category, setCategory] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [results, setResults] = useState<ScoredListing[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSearch() {
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, neighborhoodId, category, verifiedOnly }),
      });
      const data = await res.json();
      setParsed(data.parsed);
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Verra</p>
        <h1>Search</h1>
        <p className="subtitle">
          Describe what you&apos;re looking for. The query is parsed into
          structured filters (type, tags, price, open-now) on the server,
          then matched against real listings in the database.
        </p>
        <p className="nav-links">
          <a href="/">Homepage</a> &middot; <a href="/owner">Owner Panel</a>{" "}
          &middot; <a href="/admin">Admin Panel</a>
        </p>
      </header>

      <main>
        <section className="panel">
          <h2>Search</h2>
          <label htmlFor="query-input">What are you looking for?</label>
          <input
            id="query-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. cheap vegan pizza open now"
          />

          <label htmlFor="neighborhood-select">Your location (simulated)</label>
          <select
            id="neighborhood-select"
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
          >
            {NEIGHBORHOODS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          <label htmlFor="category-select">Category</label>
          <select
            id="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="restaurant">Restaurants</option>
            <option value="retail">Retail / Shops</option>
          </select>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "normal" }}>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
              />
              Verified only
            </label>
          </div>

          <button className="block-button" type="button" onClick={runSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </section>

        {parsed && (
          <section className="panel">
            <h2>Step 1 &amp; 2 — what the server understood</h2>
            <p>
              <strong>Types detected:</strong>{" "}
              {parsed.types.length ? parsed.types.map((t) => <span className="chip" key={t}>{t}</span>) : "none"}
            </p>
            <p>
              <strong>Tags detected:</strong>{" "}
              {parsed.tags.length ? parsed.tags.map((t) => <span className="chip" key={t}>{t}</span>) : "none"}
            </p>
            <p>
              <strong>Price preference:</strong>{" "}
              {parsed.priceTier ? <span className="chip">{"$".repeat(parsed.priceTier)}</span> : "none detected"}
            </p>
            <p>
              <strong>&quot;Open now&quot; requested:</strong> {parsed.wantsOpenNow ? <span className="chip">yes</span> : "no"}
            </p>
          </section>
        )}

        {results && (
          <section className="panel">
            <h2>Step 3 — ranked results</h2>
            {results.length === 0 && <p className="no-results">No listings matched those filters.</p>}
            {results.map((r) => (
              <div className="card" key={r.listing.id}>
                <div className="card-header">
                  <h3 style={{ margin: 0 }}>{r.listing.name}</h3>
                  <span className={`badge ${r.listing.verified ? "verified" : "unverified"}`}>
                    {r.listing.verified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <p className="card-meta">
                  {r.listing.category === "restaurant" ? "Restaurant" : "Retail"} &middot;{" "}
                  {"$".repeat(r.listing.priceTier)} &middot; {r.listing.types.join(", ")} &middot;{" "}
                  {r.listing.rating ? `${r.listing.rating.toFixed(1)}★` : "No rating yet"} &middot;{" "}
                  {r.openNow ? "Open now" : "Closed now"} &middot; {r.listing.neighborhoodName} &middot;{" "}
                  {r.distance.toFixed(1)} mi away (demo units)
                </p>
                <p>{r.listing.highlight}</p>
                <p style={{ color: "#7a2e2e", fontSize: "0.85rem" }}>
                  Why it matched: {r.reasons.join(", ") || "general relevance"}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer>
        <p>Verra — real backend, real database. Query understanding is still simple keyword matching for now.</p>
      </footer>
    </>
  );
}
