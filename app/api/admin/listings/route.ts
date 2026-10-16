import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  const category = req.nextUrl.searchParams.get("category") ?? "all";
  const status = req.nextUrl.searchParams.get("status") ?? "all";

  const where: {
    name?: { contains: string };
    category?: string;
    verified?: boolean;
  } = {};
  if (search) where.name = { contains: search };
  if (category !== "all") where.category = category;
  if (status === "verified") where.verified = true;
  if (status === "unverified") where.verified = false;

  const [listings, total, verifiedCount, restaurantCount, retailCount] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.listing.count(),
    prisma.listing.count({ where: { verified: true } }),
    prisma.listing.count({ where: { category: "restaurant" } }),
    prisma.listing.count({ where: { category: "retail" } }),
  ]);

  return NextResponse.json({
    listings,
    stats: {
      total,
      verified: verifiedCount,
      unverified: total - verifiedCount,
      restaurants: restaurantCount,
      retail: retailCount,
    },
  });
}
