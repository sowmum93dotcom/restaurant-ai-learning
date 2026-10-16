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
├── index.html         # Homepage content and structure
├── css/
│   └── style.css       # Homepage styling and responsive layout
├── js/
│   └── script.js        # Homepage button logic (builds a sample campaign)
├── search-demo/
│   ├── index.html       # AI search engine pipeline demo page
│   ├── style.css        # Demo styling
│   ├── data.js          # Sample restaurant + neighborhood data
│   └── script.js        # Demo pipeline logic (parse → rank → display)
└── README.md
```

## AI Restaurant Search Engine — Pipeline Demo

In `search-demo/`, there's a second, separate page that demonstrates the
bigger idea we're exploring: a search engine where a customer describes
what they want (e.g. *"affordable vegan pizza open now"*) and gets back
ranked, location-aware restaurant results.

This demo shows the **shape of the pipeline** without needing any real
services set up:

1. **Query understanding** — your typed search is scanned for cuisine,
   dietary needs, price preference, and whether you want somewhere open
   right now. (A real version would use an AI model for this step instead
   of keyword matching.)
2. **Location** — pick a sample neighborhood from the dropdown; distance
   to each restaurant is calculated and factored into ranking.
3. **Ranking** — every sample restaurant gets a score based on how well it
   matches your query, its distance, its rating, and whether it's
   verified — then results are sorted and shown with a plain-English
   explanation of *why* each one matched.

All restaurant data here is a small hard-coded sample (`data.js`) standing
in for data that would eventually come from a real source like
OpenStreetMap plus owner verification. No external AI API, map service, or
database is called — everything runs locally in the browser.

Open `search-demo/index.html` the same way as the homepage (see "How to
run it" below), or click the link at the bottom of the homepage.

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
- Replace the search demo's sample data with real listings (starting from
  OpenStreetMap data for one city/category).
- Replace the demo's keyword-matching "query understanding" step with a
  real AI model call.
- Add a real owner "claim this listing" verification flow.
