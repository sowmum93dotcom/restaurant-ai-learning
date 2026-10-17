// Real AI query understanding: sends the customer's free-text search to
// Claude and gets back structured filters via tool use. This is the real
// version of the keyword matcher in lib/search.ts.
//
// Returns null (never throws) when there's no API key configured, the
// request fails, or the response doesn't contain a usable tool call — the
// caller (lib/search.ts) falls back to keyword matching in all those
// cases, so search never breaks just because the AI call did.

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedQuery } from "@/lib/search";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_search_filters",
  description:
    "Extract structured search filters from a customer's free-text local-business search query.",
  input_schema: {
    type: "object",
    properties: {
      types: {
        type: "array",
        items: { type: "string" },
        description:
          "Cuisine types (for restaurants) or store/product types (for retail) mentioned or clearly implied, lowercase (e.g. [\"italian\",\"pizza\"] or [\"grocery\"]). Empty array if none.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Dietary needs (vegan, vegetarian, gluten-free) or product attributes (organic, handmade, eco-friendly, discount, imported) mentioned. Empty array if none.",
      },
      priceTier: {
        type: ["integer", "null"],
        description:
          "1 if the query signals cheap/budget/affordable, 3 if it signals upscale/fancy/expensive/fine dining, otherwise null.",
      },
      wantsOpenNow: {
        type: "boolean",
        description: "True only if the query explicitly asks for something open right now.",
      },
    },
    required: ["types", "tags", "priceTier", "wantsOpenNow"],
    additionalProperties: false,
  },
  strict: true,
};

// Opus 5.5 returns a 400 on forced tool_choice (type "any"/"tool"), so we
// use "auto" plus an explicit instruction, per current API guidance.
const SYSTEM_PROMPT =
  "You are the query-understanding component for Verra, a local search engine covering " +
  "restaurants and retail shops. Extract structured filters from the customer's search text " +
  "using the extract_search_filters tool. Always call the tool exactly once with your best " +
  "extraction, even if the query is vague — use empty arrays, null, or false for anything " +
  "not indicated. Do not ask questions or add commentary.";

type ExtractedFilters = {
  types: string[];
  tags: string[];
  priceTier: number | null;
  wantsOpenNow: boolean;
};

export async function parseQueryWithAI(text: string): Promise<ParsedQuery | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: text }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) return null;

    const input = toolUse.input as ExtractedFilters;

    return {
      rawText: text,
      types: input.types.map((t) => t.toLowerCase()),
      tags: input.tags.map((t) => t.toLowerCase()),
      priceTier: input.priceTier,
      wantsOpenNow: input.wantsOpenNow,
    };
  } catch (err) {
    console.error("AI query parsing failed, falling back to keyword matching:", err);
    return null;
  }
}
