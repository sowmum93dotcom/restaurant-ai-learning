import MarketingAssistant from "@/app/components/MarketingAssistant";

export default function HomePage() {
  return (
    <>
      <header className="hero">
        <h1>Bella Vista Bistro</h1>
        <p className="subtitle" style={{ fontStyle: "italic" }}>
          Italian Cuisine
        </p>
        <div className="subtitle">
          <p>📍 123 Main Street, Springfield</p>
          <p>
            🌐{" "}
            <a
              href="https://www.bellavistabistro.example.com"
              target="_blank"
              rel="noopener"
            >
              www.bellavistabistro.example.com
            </a>
          </p>
        </div>
      </header>

      <main>
        <MarketingAssistant />
      </main>

      <footer>
        <p>
          &copy; 2026 Bella Vista Bistro — Built with the Restaurant AI
          Marketing Assistant (learning project)
        </p>
        <p>
          Verra (AI Local Search Engine):{" "}
          <a href="/search">Search</a> &middot; <a href="/owner">Owner Panel</a>{" "}
          &middot; <a href="/admin">Admin Panel</a>
        </p>
      </footer>
    </>
  );
}
