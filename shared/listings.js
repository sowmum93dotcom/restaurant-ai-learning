// Shared data layer used by the search demo, owner panel, and admin panel.
//
// There's no real backend yet, so this uses the browser's localStorage as a
// stand-in "database": all three pages read and write the same listings
// array from localStorage. This only works within one browser (it does not
// sync between devices or users) — a real version would replace this file
// with calls to an actual backend/database.

const LISTINGS_STORAGE_KEY = "ai-search-listings-v1";

const NEIGHBORHOODS = [
  { id: "downtown", name: "Downtown", x: 0, y: 0 },
  { id: "riverside", name: "Riverside", x: 3, y: 1 },
  { id: "hillcrest", name: "Hillcrest", x: -2, y: 4 },
  { id: "old-town", name: "Old Town", x: 1, y: -3 },
];

const SEED_LISTINGS = [
  {
    id: "seed-1",
    category: "restaurant",
    name: "Bella Vista Bistro",
    types: ["italian", "pizza"],
    tags: ["vegetarian"],
    priceTier: 2,
    neighborhood: "downtown",
    coords: { x: 0.2, y: 0.1 },
    hours: { open: "11:00", close: "22:00" },
    verified: true,
    selfAttested: false,
    rating: 4.6,
    highlight: "Wood-fired pizza and fresh pasta",
  },
  {
    id: "seed-2",
    category: "restaurant",
    name: "Green Leaf Vegan Kitchen",
    types: ["vegan", "pizza", "salad"],
    tags: ["vegan", "vegetarian", "gluten-free"],
    priceTier: 1,
    neighborhood: "riverside",
    coords: { x: 3.1, y: 1.2 },
    hours: { open: "10:00", close: "21:00" },
    verified: true,
    selfAttested: false,
    rating: 4.4,
    highlight: "100% plant-based menu, vegan pizza nights on Fridays",
  },
  {
    id: "seed-3",
    category: "restaurant",
    name: "Golden Dragon",
    types: ["chinese"],
    tags: [],
    priceTier: 1,
    neighborhood: "old-town",
    coords: { x: 0.9, y: -2.8 },
    hours: { open: "11:30", close: "22:30" },
    verified: false,
    selfAttested: false,
    rating: 4.1,
    highlight: "Classic Cantonese dishes, fast takeout",
  },
  {
    id: "seed-4",
    category: "restaurant",
    name: "Sakura Sushi House",
    types: ["japanese", "sushi"],
    tags: ["gluten-free"],
    priceTier: 3,
    neighborhood: "downtown",
    coords: { x: -0.3, y: 0.4 },
    hours: { open: "12:00", close: "23:00" },
    verified: true,
    selfAttested: false,
    rating: 4.8,
    highlight: "Omakase counter and fresh daily catch",
  },
  {
    id: "seed-5",
    category: "restaurant",
    name: "Taco Social",
    types: ["mexican"],
    tags: ["vegan", "vegetarian"],
    priceTier: 1,
    neighborhood: "riverside",
    coords: { x: 2.8, y: 0.8 },
    hours: { open: "11:00", close: "20:00" },
    verified: true,
    selfAttested: false,
    rating: 4.3,
    highlight: "Build-your-own tacos, vegan jackfruit option",
  },
  {
    id: "seed-6",
    category: "restaurant",
    name: "Curry Corner",
    types: ["indian"],
    tags: ["vegan", "vegetarian", "gluten-free"],
    priceTier: 1,
    neighborhood: "hillcrest",
    coords: { x: -1.8, y: 4.2 },
    hours: { open: "11:00", close: "21:30" },
    verified: true,
    selfAttested: false,
    rating: 4.5,
    highlight: "Extensive vegan and gluten-free curry menu",
  },
  {
    id: "seed-7",
    category: "retail",
    name: "Thread & Co.",
    types: ["clothing"],
    tags: ["handmade", "eco-friendly"],
    priceTier: 2,
    neighborhood: "downtown",
    coords: { x: 0.1, y: -0.2 },
    hours: { open: "10:00", close: "19:00" },
    verified: true,
    selfAttested: false,
    rating: 4.5,
    highlight: "Locally made clothing, small-batch runs",
  },
  {
    id: "seed-8",
    category: "retail",
    name: "Riverside Market",
    types: ["grocery"],
    tags: ["organic"],
    priceTier: 2,
    neighborhood: "riverside",
    coords: { x: 3.3, y: 0.9 },
    hours: { open: "08:00", close: "21:00" },
    verified: true,
    selfAttested: false,
    rating: 4.2,
    highlight: "Organic produce and bulk goods",
  },
  {
    id: "seed-9",
    category: "retail",
    name: "ByteStop Electronics",
    types: ["electronics"],
    tags: ["discount"],
    priceTier: 1,
    neighborhood: "old-town",
    coords: { x: 1.1, y: -3.1 },
    hours: { open: "09:00", close: "20:00" },
    verified: false,
    selfAttested: false,
    rating: 3.9,
    highlight: "Phone and laptop repairs, budget accessories",
  },
  {
    id: "seed-10",
    category: "retail",
    name: "Hillcrest Books & Gifts",
    types: ["bookstore", "gift shop"],
    tags: ["handmade"],
    priceTier: 2,
    neighborhood: "hillcrest",
    coords: { x: -2.3, y: 3.7 },
    hours: { open: "10:00", close: "18:00" },
    verified: true,
    selfAttested: false,
    rating: 4.7,
    highlight: "Independent bookstore with local author gifts",
  },
  {
    id: "seed-11",
    category: "retail",
    name: "Sunrise Pharmacy",
    types: ["pharmacy"],
    tags: [],
    priceTier: 2,
    neighborhood: "downtown",
    coords: { x: -0.4, y: 0.3 },
    hours: { open: "08:00", close: "22:00" },
    verified: true,
    selfAttested: false,
    rating: 4.0,
    highlight: "Full-service pharmacy, same-day prescriptions",
  },
];

function loadListings() {
  try {
    const raw = window.localStorage.getItem(LISTINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // localStorage unavailable (private browsing, etc.) — fall through to seed data
  }
  saveListings(SEED_LISTINGS);
  return SEED_LISTINGS.slice();
}

function saveListings(listings) {
  try {
    window.localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(listings));
  } catch (e) {
    // localStorage unavailable — changes won't persist, but the page still works this session
  }
}

function addListing(listing) {
  const listings = loadListings();
  const withId = { ...listing, id: "listing-" + Date.now() };
  listings.push(withId);
  saveListings(listings);
  return withId;
}

function updateListing(id, patch) {
  const listings = loadListings();
  const index = listings.findIndex((l) => l.id === id);
  if (index === -1) return null;
  listings[index] = { ...listings[index], ...patch };
  saveListings(listings);
  return listings[index];
}

function deleteListing(id) {
  const listings = loadListings().filter((l) => l.id !== id);
  saveListings(listings);
}

function findListingsByName(query) {
  const lower = query.trim().toLowerCase();
  if (!lower) return [];
  return loadListings().filter((l) => l.name.toLowerCase().includes(lower));
}

function resetListings() {
  saveListings(SEED_LISTINGS);
  return SEED_LISTINGS.slice();
}
