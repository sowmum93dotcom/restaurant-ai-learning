// Seeds the database with the same sample listings the earlier static
// demo used, plus one admin account so the admin panel is usable right
// after setup. Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_LISTINGS } from "../lib/seedData";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.listingClaim.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  for (const listing of SEED_LISTINGS) {
    await prisma.listing.create({ data: { ...listing, source: "seed" } });
  }

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@verra.app",
      passwordHash: adminPasswordHash,
      role: "admin",
    },
  });

  console.log(`Seeded ${SEED_LISTINGS.length} listings.`);
  console.log("Admin login: admin@verra.app / admin123 (change this before deploying anywhere real)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
