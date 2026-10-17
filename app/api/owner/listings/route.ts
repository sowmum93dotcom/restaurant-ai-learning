import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { findNeighborhood } from "@/lib/neighborhoods";
import { validateListingInput } from "@/lib/listingValidation";

// GET /api/owner/listings?q=... — search listings by name, to claim one.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ listings: [] });

  const listings = await prisma.listing.findMany({
    where: { name: { contains: q } },
    take: 10,
  });

  return NextResponse.json({ listings });
}

// POST /api/owner/listings — add a brand new listing, self-attested verified.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body?.confirmed) {
    return NextResponse.json(
      { error: "You must confirm you are the owner or an authorized representative." },
      { status: 400 }
    );
  }

  const validation = validateListingInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const data = validation.data;

  const neighborhoodCoords = findNeighborhood(data.neighborhood) ?? { x: 0, y: 0 };

  const listing = await prisma.listing.create({
    data: {
      ...data,
      x: neighborhoodCoords.x,
      y: neighborhoodCoords.y,
      verified: true,
      verificationLevel: "self_attested",
      source: "owner",
      rating: 0,
    },
  });

  await prisma.listingClaim.create({
    data: { listingId: listing.id, userId: user.id, status: "approved" },
  });

  return NextResponse.json({ listing });
}
