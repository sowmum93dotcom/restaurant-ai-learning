import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.listingClaim.deleteMany({ where: { listingId: id } });
  await prisma.listing.delete({ where: { id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}
