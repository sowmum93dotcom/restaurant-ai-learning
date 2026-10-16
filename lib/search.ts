// Server-side version of the search pipeline: query understanding, scoring,
// and ranking. This is the same logic the earlier static demo ran in the
// browser, now run on the server against real database rows.
//
// The query-understanding step below is still simple keyword matching, not
// a real AI model call — that's the next phase (see the Architecture Plan
// doc's "Search & AI Pipeline" section). This phase's job is the real
// backend + database; swapping this function's internals for a Claude API
// call later won't require changing anything that calls it.

import type { Listing } from "@prisma/client";
import { findNeighborhood } from "@/lib/neighborhoods";

const TYPE_WORDS = [
  "italian", "pizza", "chinese", "japanese", "sushi", "mexican",
  "steak", "american", "indian", "vegan", "salad", "taco", "tacos",
  "clothing", "grocery", "electronics", "bookstore", "gift shop",
  "pharmacy", "bakery",
];

const TAG_WORDS = [
  "vegan", "vegetarian", "gluten-free", "gluten free",
  "organic", "handmade", "eco-friendly", "discount", "imported",
];

const CHEAP_WORDS = ["cheap", "affordable", "budget", "inexpensive", "discount"];
const UPSCALE_WORDS = ["fancy", "upscale", "expensive", "fine dining"];

export type ParsedQuery = {
  rawText: string;
  types: string[];
  tags: string[];
  priceTier: number | null;
  wantsOpenNow: boolean;
};

export function parseQuery(text: string): ParsedQuery {
  const lower = text.toLowerCase();

  const types = TYPE_WORDS.filter((word) => lower.includes(word));
  const tags = TAG_WORDS.filter((word) => lower.includes(word)).map((w) =>
    w === "gluten free" ? "gluten-free" : w
  );

  let priceTier: number | null = null;
  if (CHEAP_WORDS.some((w) => lower.includes(w))) priceTier = 1;
  if (UPSCALE_WORDS.some((w) => lower.includes(w))) priceTier = 3;

  const wantsOpenNow =
    lower.includes("open now") || lower.includes("open right now");

  return { rawText: text, types, tags, priceTier, wantsOpenNow };
}

export function computeOpenNow(hoursOpen: string, hoursClose: string): boolean {
  const now = new Date();
  const [openH, openM] = hoursOpen.split(":").map(Number);
  const [closeH, closeM] = hoursClose.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

export type ScoredListing = {
  listing: Omit<Listing, "types" | "tags"> & {
    types: string[];
    tags: string[];
    neighborhoodName: string;
  };
  score: number;
  reasons: string[];
  openNow: boolean;
  distance: number;
};

export function scoreListing(
  listing: Listing,
  parsed: ParsedQuery,
  userCoords: { x: number; y: number },
  verifiedOnly: boolean,
  category: string
): ScoredListing | null {
  if (verifiedOnly && !listing.verified) return null;
  if (category !== "all" && listing.category !== category) return null;

  const types = splitList(listing.types);
  const tags = splitList(listing.tags);

  const openNow = computeOpenNow(listing.hoursOpen, listing.hoursClose);
  if (parsed.wantsOpenNow && !openNow) return null; // hard filter

  let score = 0;
  const reasons: string[] = [];

  parsed.types.forEach((t) => {
    if (types.includes(t)) {
      score += 3;
      reasons.push(`matches "${t}"`);
    }
  });

  parsed.tags.forEach((t) => {
    if (tags.includes(t)) {
      score += 3;
      reasons.push(`matches "${t}"`);
    }
  });

  if (parsed.priceTier && listing.priceTier === parsed.priceTier) {
    score += 2;
    reasons.push("matches price range");
  }

  if (parsed.wantsOpenNow && openNow) {
    score += 2;
    reasons.push("open right now");
  }

  if (listing.verified) {
    score += 1;
    reasons.push("verified location");
  }

  score += listing.rating / 5; // small boost for higher-rated places

  const dist = distance(userCoords, { x: listing.x, y: listing.y });
  score -= dist * 0.3; // closer listings rank slightly higher

  const neighborhoodName = findNeighborhood(listing.neighborhood)?.name ?? listing.neighborhood;

  return {
    listing: { ...listing, types, tags, neighborhoodName },
    score,
    reasons,
    openNow,
    distance: dist,
  };
}
