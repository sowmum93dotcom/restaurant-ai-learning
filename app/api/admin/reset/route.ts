import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { SEED_LISTINGS } from "@/lib/seedData";

// Resets listings back to the original sample data. Does not touch user
// accounts, so the admin stays logged in after a reset.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await prisma.listingClaim.deleteMany();
  await prisma.listing.deleteMany();
  for (const listing of SEED_LISTINGS) {
    await prisma.listing.create({ data: { ...listing, source: "seed" } });
  }

  return NextResponse.json({ ok: true });
}
