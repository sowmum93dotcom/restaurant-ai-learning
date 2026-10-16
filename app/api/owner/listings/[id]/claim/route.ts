import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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

  const body = await req.json().catch(() => null);
  const { category, name, neighborhood, types, tags, priceTier, hoursOpen, hoursClose, highlight, confirmed } =
    body ?? {};

  if (!confirmed) {
    return NextResponse.json(
      { error: "You must confirm you are the owner or an authorized representative." },
      { status: 400 }
    );
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      category: category ?? existing.category,
      name: name ?? existing.name,
      neighborhood: neighborhood ?? existing.neighborhood,
      types: typeof types === "string" ? types : existing.types,
      tags: typeof tags === "string" ? tags : existing.tags,
      priceTier: priceTier ? Number(priceTier) : existing.priceTier,
      hoursOpen: hoursOpen ?? existing.hoursOpen,
      hoursClose: hoursClose ?? existing.hoursClose,
      highlight: typeof highlight === "string" ? highlight : existing.highlight,
      verified: true,
      verificationLevel: "self_attested",
    },
  });

  await prisma.listingClaim.create({
    data: { listingId: listing.id, userId: user.id, status: "approved" },
  });

  return NextResponse.json({ listing });
}
