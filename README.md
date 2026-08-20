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
├── index.html       # Page content and structure
├── css/
│   └── style.css     # Styling and responsive layout
├── js/
│   └── script.js      # Button logic (builds a sample campaign)
└── README.md
```

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
