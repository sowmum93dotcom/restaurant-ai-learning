import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findNeighborhood } from "@/lib/neighborhoods";
import { parseQuery, scoreListing } from "@/lib/search";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const queryText = typeof body?.query === "string" ? body.query : "";
  const neighborhoodId = typeof body?.neighborhoodId === "string" ? body.neighborhoodId : "downtown";
  const category = typeof body?.category === "string" ? body.category : "all";
  const verifiedOnly = Boolean(body?.verifiedOnly);

  const userNeighborhood = findNeighborhood(neighborhoodId) ?? findNeighborhood("downtown")!;
  const parsed = await parseQuery(queryText);

  const listings = await prisma.listing.findMany();

  const scored = listings
    .map((listing) =>
      scoreListing(listing, parsed, userNeighborhood, verifiedOnly, category)
    )
    .filter((r) => r !== null)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ parsed, results: scored });
}
