// Shared input validation for the owner-facing write paths (add a new
// listing, claim/edit an existing one). Keeping this in one place means
// both routes reject the same garbage input the same way, instead of
// each route guessing independently.

import { NEIGHBORHOODS } from "@/lib/neighborhoods";

export const VALID_CATEGORIES = ["restaurant", "retail"] as const;
const HOURS_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NAME_LENGTH = 100;
const MAX_LIST_FIELD_LENGTH = 200; // types / tags, as stored comma-separated
const MAX_HIGHLIGHT_LENGTH = 200;

export type ValidatedListingInput = {
  category: string;
  name: string;
  neighborhood: string;
  types: string;
  tags: string;
  priceTier: number;
  hoursOpen: string;
  hoursClose: string;
  highlight: string;
};

export type ValidationResult =
  | { ok: true; data: ValidatedListingInput }
  | { ok: false; error: string };

export function validateListingInput(body: unknown): ValidationResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const category = typeof b.category === "string" ? b.category : "";
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return { ok: false, error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}.` };
  }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Business name is required." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Business name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }

  const neighborhood = typeof b.neighborhood === "string" ? b.neighborhood : "";
  if (!NEIGHBORHOODS.some((n) => n.id === neighborhood)) {
    return { ok: false, error: "Choose a valid neighborhood." };
  }

  const hoursOpen = typeof b.hoursOpen === "string" ? b.hoursOpen : "";
  const hoursClose = typeof b.hoursClose === "string" ? b.hoursClose : "";
  if (!HOURS_PATTERN.test(hoursOpen) || !HOURS_PATTERN.test(hoursClose)) {
    return { ok: false, error: "Hours must be in HH:MM format (24-hour)." };
  }

  const priceTierRaw = Number(b.priceTier);
  const priceTier = [1, 2, 3].includes(priceTierRaw) ? priceTierRaw : 2;

  const types = typeof b.types === "string" ? b.types.slice(0, MAX_LIST_FIELD_LENGTH) : "";
  const tags = typeof b.tags === "string" ? b.tags.slice(0, MAX_LIST_FIELD_LENGTH) : "";
  const highlight =
    typeof b.highlight === "string" ? b.highlight.trim().slice(0, MAX_HIGHLIGHT_LENGTH) : "";

  return {
    ok: true,
    data: { category, name, neighborhood, types, tags, priceTier, hoursOpen, hoursClose, highlight },
  };
}
