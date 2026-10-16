"use client";

import { useEffect, useState } from "react";

type User = { id: string; email: string; role: string };
type Listing = {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  verified: boolean;
  types: string;
  tags: string;
  priceTier: number;
  hoursOpen: string;
  hoursClose: string;
  highlight: string;
};

const NEIGHBORHOODS = [
  { id: "downtown", name: "Downtown" },
  { id: "riverside", name: "Riverside" },
  { id: "hillcrest", name: "Hillcrest" },
  { id: "old-town", name: "Old Town" },
];

function AuthGate({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onSignedIn(data.user);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>{mode === "login" ? "Sign in" : "Create an owner account"}</h2>
      <form onSubmit={submit}>
        <label htmlFor="email-input">Email</label>
        <input id="email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password-input">Password</label>
        <input
          id="password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <button className="block-button" type="submit" disabled={busy}>
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <p style={{ marginTop: "1rem" }}>
        {mode === "login" ? (
          <>
            New here?{" "}
            <button className="link-button" type="button" onClick={() => setMode("signup")}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button className="link-button" type="button" onClick={() => setMode("login")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </section>
  );
}

function ListingForm({
  initial,
  heading,
  onSubmit,
  message,
}: {
  initial?: Partial<Listing>;
  heading: string;
  onSubmit: (data: Record<string, unknown>) => void;
  message: string | null;
}) {
  const [category, setCategory] = useState(initial?.category ?? "restaurant");
  const [name, setName] = useState(initial?.name ?? "");
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "downtown");
  const [types, setTypes] = useState(initial?.types ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [priceTier, setPriceTier] = useState(String(initial?.priceTier ?? 2));
  const [hoursOpen, setHoursOpen] = useState(initial?.hoursOpen ?? "09:00");
  const [hoursClose, setHoursClose] = useState(initial?.hoursClose ?? "18:00");
  const [highlight, setHighlight] = useState(initial?.highlight ?? "");
  const [confirmed, setConfirmed] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ category, name, neighborhood, types, tags, priceTier, hoursOpen, hoursClose, highlight, confirmed });
  }

  return (
    <section className="panel">
      <h2>{heading}</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="category-input">Category</label>
        <select id="category-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="restaurant">Restaurant</option>
          <option value="retail">Retail / Shop</option>
        </select>

        <label htmlFor="name-input">Business name</label>
        <input id="name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="neighborhood-input">Neighborhood</label>
        <select id="neighborhood-input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
          {NEIGHBORHOODS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        <label htmlFor="types-input">
          Type(s) <span className="hint">(comma-separated, e.g. &quot;italian, pizza&quot; or &quot;grocery&quot;)</span>
        </label>
        <input id="types-input" type="text" value={types} onChange={(e) => setTypes(e.target.value)} required />

        <label htmlFor="tags-input">
          Tags <span className="hint">(comma-separated, optional — e.g. &quot;vegan, gluten-free&quot;)</span>
        </label>
        <input id="tags-input" type="text" value={tags} onChange={(e) => setTags(e.target.value)} />

        <label htmlFor="price-input">Price range</label>
        <select id="price-input" value={priceTier} onChange={(e) => setPriceTier(e.target.value)}>
          <option value="1">$ (budget)</option>
          <option value="2">$$ (moderate)</option>
          <option value="3">$$$ (upscale)</option>
        </select>

        <div className="row">
          <div>
            <label htmlFor="open-input">Opens</label>
            <input id="open-input" type="time" value={hoursOpen} onChange={(e) => setHoursOpen(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="close-input">Closes</label>
            <input id="close-input" type="time" value={hoursClose} onChange={(e) => setHoursClose(e.target.value)} required />
          </div>
        </div>

        <label htmlFor="highlight-input">One-line description</label>
        <input
          id="highlight-input"
          type="text"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          placeholder="What makes this place worth visiting?"
        />

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontWeight: "normal", fontSize: "0.9rem" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required style={{ width: "auto", marginTop: "0.2rem" }} />
          I confirm I am the owner or an authorized representative of this business, and the details above are accurate.
        </label>

        <button className="block-button" type="submit">
          Save listing
        </button>
      </form>
      {message && <div className="success-message">{message}</div>}
    </section>
  );
}

export default function OwnerPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still loading
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<Listing[] | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | "new" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function handleSearch() {
    const res = await fetch(`/api/owner/listings?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setMatches(data.listings ?? []);
  }

  async function handleClaimOrCreate(data: Record<string, unknown>) {
    setMessage(null);
    const isNew = editingListing === "new";
    const url = isNew ? "/api/owner/listings" : `/api/owner/listings/${(editingListing as Listing).id}/claim`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }
    setMessage(
      `Saved. "${result.listing.name}" is now marked verified (self-attested). You can search for it on the Search page, or an admin can review it in the Admin Panel.`
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Verra</p>
        <h1>Owner Panel</h1>
        <p className="subtitle">
          Claim your business listing or add a new one. Checking the confirmation box marks a listing
          &quot;verified&quot; immediately — that&apos;s a <strong>self-attestation</strong>, not a real identity
          check. A real version would confirm ownership by email, phone, or document upload before marking
          anything verified, and an admin can still review it afterward.
        </p>
        <p className="nav-links">
          <a href="/">Homepage</a> &middot; <a href="/search">Search</a> &middot; <a href="/admin">Admin Panel</a>
        </p>
      </header>

      <main>
        {user === undefined && <p>Loading...</p>}

        {user === null && <AuthGate onSignedIn={setUser} />}

        {user && (
          <>
            <section className="panel">
              <p>
                Signed in as <strong>{user.email}</strong>.{" "}
                <button className="link-button" type="button" onClick={logout}>
                  Sign out
                </button>
              </p>
            </section>

            <section className="panel">
              <h2>Step 1 — Find your business</h2>
              <label htmlFor="biz-search-input">Business name</label>
              <input
                id="biz-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Golden Dragon"
              />
              <button type="button" onClick={handleSearch} style={{ marginTop: "0.75rem" }}>
                Search
              </button>

              {matches && (
                <div style={{ marginTop: "1rem" }}>
                  {matches.length === 0 && <p className="no-results">No matching listing found.</p>}
                  {matches.map((l) => (
                    <div className="card" key={l.id}>
                      <div className="card-header">
                        <div>
                          <strong>{l.name}</strong>{" "}
                          <span className={`badge ${l.verified ? "verified" : "unverified"}`}>
                            {l.verified ? "Verified" : "Unverified"}
                          </span>
                          <p className="card-meta">
                            {l.category === "restaurant" ? "Restaurant" : "Retail"} &middot; {l.neighborhood}
                          </p>
                        </div>
                        <button type="button" onClick={() => setEditingListing(l)}>
                          Claim &amp; edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ marginTop: "1rem", color: "#555" }}>
                Can&apos;t find your business?{" "}
                <button className="link-button" type="button" onClick={() => setEditingListing("new")}>
                  Add a new listing
                </button>
              </p>
            </section>

            {editingListing && (
              <ListingForm
                key={editingListing === "new" ? "new" : editingListing.id}
                heading={editingListing === "new" ? "Step 2 — New listing details" : `Step 2 — Edit "${editingListing.name}"`}
                initial={editingListing === "new" ? undefined : editingListing}
                onSubmit={handleClaimOrCreate}
                message={message}
              />
            )}
          </>
        )}
      </main>

      <footer>
        <p>Verra — data is stored in a real database (SQLite for local development).</p>
      </footer>
    </>
  );
}
