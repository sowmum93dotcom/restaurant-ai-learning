"use client";

import { useEffect, useState } from "react";

type User = { id: string; email: string; role: string };
type Listing = {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  priceTier: number;
  verified: boolean;
  verificationLevel: string;
  source: string;
  rating: number;
};
type Stats = { total: number; verified: number; unverified: number; restaurants: number; retail: number };

function AdminLogin({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
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
      <h2>Admin sign in</h2>
      <p style={{ color: "#777", fontSize: "0.9rem" }}>
        Seeded admin account: <code>admin@verra.app</code> / <code>admin123</code> — change this before
        deploying anywhere real.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="email-input">Email</label>
        <input id="email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password-input">Password</label>
        <input
          id="password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="block-button" type="submit" disabled={busy}>
          {busy ? "Please wait..." : "Sign in"}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function loadListings() {
    const params = new URLSearchParams({ search, category, status });
    const res = await fetch(`/api/admin/listings?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setListings(data.listings);
    setStats(data.stats);
  }

  useEffect(() => {
    if (user?.role === "admin") loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, category, status]);

  async function toggleVerify(id: string) {
    await fetch(`/api/admin/listings/${id}/verify`, { method: "PATCH" });
    loadListings();
  }

  async function deleteListing(id: string) {
    await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
    loadListings();
  }

  async function resetData() {
    await fetch("/api/admin/reset", { method: "POST" });
    loadListings();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Verra</p>
        <h1>Admin Panel</h1>
        <p className="subtitle">
          Review every listing across both categories, verify or unverify them, and remove bad entries.
        </p>
        <p className="nav-links">
          <a href="/">Homepage</a> &middot; <a href="/search">Search</a> &middot; <a href="/owner">Owner Panel</a>
        </p>
      </header>

      <main>
        {user === undefined && <p>Loading...</p>}

        {user === null && <AdminLogin onSignedIn={setUser} />}

        {user && user.role !== "admin" && (
          <section className="panel">
            <p>
              Signed in as <strong>{user.email}</strong>, which is an owner account, not an admin account.
            </p>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </section>
        )}

        {user && user.role === "admin" && (
          <>
            <section className="panel">
              <p>
                Signed in as <strong>{user.email}</strong>.{" "}
                <button className="link-button" type="button" onClick={logout}>
                  Sign out
                </button>
              </p>
            </section>

            {stats && (
              <section className="panel stats-row">
                <div className="stat">
                  <span className="stat-number">{stats.total}</span>
                  <span className="stat-label">Total listings</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{stats.verified}</span>
                  <span className="stat-label">Verified</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{stats.unverified}</span>
                  <span className="stat-label">Unverified</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{stats.restaurants}</span>
                  <span className="stat-label">Restaurants</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{stats.retail}</span>
                  <span className="stat-label">Retail</span>
                </div>
              </section>
            )}

            <section className="panel">
              <div className="row">
                <div>
                  <label htmlFor="filter-search">Search by name</label>
                  <input id="filter-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="filter-category">Category</label>
                  <select id="filter-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">All</option>
                    <option value="restaurant">Restaurants</option>
                    <option value="retail">Retail</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-status">Status</label>
                  <select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
              </div>

              <div className="table-wrapper" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Neighborhood</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Rating</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="no-results" style={{ textAlign: "center", padding: "1.5rem 0" }}>
                          No listings match these filters.
                        </td>
                      </tr>
                    )}
                    {listings.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.name}</strong>
                          {l.verificationLevel === "self_attested" && (
                            <div style={{ fontSize: "0.75rem", color: "#999" }}>self-attested by owner</div>
                          )}
                        </td>
                        <td>{l.category === "restaurant" ? "Restaurant" : "Retail"}</td>
                        <td>{l.neighborhood}</td>
                        <td>{"$".repeat(l.priceTier)}</td>
                        <td>
                          <span className={`badge ${l.verified ? "verified" : "unverified"}`}>
                            {l.verified ? "Verified" : "Unverified"}
                          </span>
                        </td>
                        <td>{l.rating ? `${l.rating.toFixed(1)}★` : "—"}</td>
                        <td className="actions-cell">
                          <button type="button" onClick={() => toggleVerify(l.id)}>
                            {l.verified ? "Unverify" : "Verify"}
                          </button>
                          <button className="secondary" type="button" onClick={() => deleteListing(l.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <h2>Demo data</h2>
              <p style={{ color: "#777" }}>
                Resets listings back to the original sample data, discarding anything added or changed via the
                owner panel or here.
              </p>
              <button className="secondary" type="button" onClick={resetData}>
                Reset to sample data
              </button>
            </section>
          </>
        )}
      </main>

      <footer>
        <p>Verra — real backend, real database. Admin access requires an admin-role account.</p>
      </footer>
    </>
  );
}
