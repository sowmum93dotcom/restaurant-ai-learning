import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      verified: !existing.verified,
      verificationLevel: !existing.verified ? "confirmed" : "unverified",
    },
  });

  return NextResponse.json({ listing });
}
