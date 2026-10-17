import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { findNeighborhood } from "@/lib/neighborhoods";
import { validateListingInput } from "@/lib/listingValidation";

// POST /api/owner/listings/:id/claim — claim an existing listing and
// correct its details. Marks it verified (self-attested), not a real
// identity check — see the README / Architecture Plan for the real
// verification path this stands in for.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body?.confirmed) {
    return NextResponse.json(
      { error: "You must confirm you are the owner or an authorized representative." },
      { status: 400 }
    );
  }

  // Fields the owner didn't touch keep the listing's current value — only
  // what they actually submit (plus that unchanged rest) gets validated.
  const merged = {
    category: body.category ?? existing.category,
    name: body.name ?? existing.name,
    neighborhood: body.neighborhood ?? existing.neighborhood,
    types: body.types ?? existing.types,
    tags: body.tags ?? existing.tags,
    priceTier: body.priceTier ?? existing.priceTier,
    hoursOpen: body.hoursOpen ?? existing.hoursOpen,
    hoursClose: body.hoursClose ?? existing.hoursClose,
    highlight: body.highlight ?? existing.highlight,
  };

  const validation = validateListingInput(merged);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const data = validation.data;
  const neighborhoodCoords = findNeighborhood(data.neighborhood) ?? { x: existing.x, y: existing.y };

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...data,
      x: neighborhoodCoords.x,
      y: neighborhoodCoords.y,
      verified: true,
      verificationLevel: "self_attested",
    },
  });

  await prisma.listingClaim.create({
    data: { listingId: listing.id, userId: user.id, status: "approved" },
  });

  return NextResponse.json({ listing });
}
