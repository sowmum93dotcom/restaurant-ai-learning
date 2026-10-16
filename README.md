# Restaurant AI Marketing — Learning Project

A simple, beginner-friendly web app for a restaurant homepage with an
"AI Marketing Assistant" section. This is the **first working version (MVP)**.

## What's included

- A clean homepage showing the restaurant's name, cuisine type, location,
  and website address.
- An "AI Marketing Assistant" section where a restaurant owner can type
  what they want to promote (e.g. a new dish or event) and click
  **Generate Marketing Campaign** to see sample marketing copy appear
  below.

## What's NOT included yet (on purpose)

This version is intentionally simple, so it does **not** include:

- Payments
- User accounts / authentication
- A database
- Any external APIs
- Real AI integration

The "Generate Marketing Campaign" button currently uses a small JavaScript
function that builds sample text locally in your browser — it does not
call any AI service. This keeps the project easy to understand while we
build up the basics. Real AI integration can be added later.

## Technology

Just plain **HTML, CSS, and JavaScript** — no frameworks, no build tools,
no installation required. This keeps the project simple and easy to read
for anyone learning web development.

## File structure

```
restaurant-ai-learning/
├── index.html           # Homepage content and structure
├── css/
│   └── style.css         # Homepage styling and responsive layout
├── js/
│   └── script.js          # Homepage button logic (builds a sample campaign)
├── shared/
│   └── listings.js        # Shared data layer used by all 3 demo pages below
├── search-demo/
│   ├── index.html         # Customer-facing AI search page
│   ├── style.css
│   └── script.js           # Search pipeline logic (parse → rank → display)
├── owner-panel/
│   ├── index.html         # Business owner: claim/add a listing
│   ├── style.css
│   └── script.js
├── admin-panel/
│   ├── index.html         # Admin: review/verify/delete listings
│   ├── style.css
│   └── script.js
└── README.md
```

## AI Local Search Engine — Pipeline Demo

Beyond the homepage, there are three linked pages that demonstrate the
bigger idea we're exploring: a search engine covering two categories
(**restaurants** and **retail shops**) where a customer describes what
they want and gets back ranked, location-aware, verified results.

### 1. Search (`search-demo/`)

A customer types what they want (e.g. *"affordable vegan pizza open
now"*) and the page shows the pipeline working:

1. **Query understanding** — the text is scanned for type (cuisine/store
   type), tags (dietary/product), price preference, and whether they want
   somewhere open right now. (A real version would use an AI model here
   instead of keyword matching.)
2. **Location** — pick a sample neighborhood; distance to each listing
   factors into ranking.
3. **Ranking** — every listing gets a score based on match quality,
   distance, rating, and verification status, then results are shown with
   a plain-English explanation of *why* each one matched. A category
   filter narrows results to restaurants, retail, or both.

### 2. Owner Panel (`owner-panel/`)

Lets a business owner search for their business, claim it, and correct
its details — or add a new listing if it's not found yet. Checking the
confirmation box marks the listing **verified** immediately. This is a
**self-attestation**, not a real identity check — a real version would
confirm ownership by email, phone, or document upload first.

### 3. Admin Panel (`admin-panel/`)

Lets you review every listing across both categories: see verified vs.
unverified counts, filter by category/status/name, toggle verification,
delete bad entries, or reset everything back to the original sample data.

### How the three pages share data

There's no real backend yet, so all three pages read and write the same
listings through `shared/listings.js`, which stores them in your
**browser's local storage** — a built-in browser feature for saving small
amounts of data on your own device. This means:

- Claiming a listing in the Owner Panel shows up as verified in the Admin
  Panel and in Search immediately.
- It only works **within one browser** — it does not sync across devices
  or between different people. A real version would replace this file
  with calls to an actual backend and database.

All data starts from a small hard-coded sample (`shared/listings.js`)
standing in for data that would eventually come from a real source like
OpenStreetMap plus owner verification. No external AI API, map service,
or real database is called — everything runs locally in the browser.

Open any of the three pages the same way as the homepage (see "How to run
it" below), or use the links in the homepage footer.

## How to run it

You don't need to install anything. Just open the page in a browser:

1. Download or clone this repository.
2. Open the `index.html` file in any web browser (double-click it, or
   right-click → "Open with" → your browser).

That's it — the page will load and you can try the AI Marketing Assistant
section right away.

### Optional: run a local server

Some browsers restrict certain features when opening files directly
(this project doesn't currently need any, but it's a good habit). If you'd
like to serve it locally instead:

```bash
# From inside the restaurant-ai-learning folder:
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Next steps (future versions)

- Connect the "Generate Marketing Campaign" button to a real AI service.
- Let the restaurant owner edit their own name/cuisine/location/website
  instead of hard-coded values.
- Add a database to save campaigns.
- Add user accounts.
- Replace the sample data with real listings (starting from OpenStreetMap
  data for one city).
- Replace the demo's keyword-matching "query understanding" step with a
  real AI model call.
- Replace local-storage "sharing" with a real backend and database, so
  data syncs across devices and between different owners/admins.
- Add real owner identity verification (email/phone/document) instead of
  the current self-attestation checkbox.
- Add admin login instead of an open admin panel.
