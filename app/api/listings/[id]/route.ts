import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findNeighborhood } from "@/lib/neighborhoods";
import { splitList } from "@/lib/search";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...listing,
    types: splitList(listing.types),
    tags: splitList(listing.tags),
    neighborhoodName: findNeighborhood(listing.neighborhood)?.name ?? listing.neighborhood,
  });
}
