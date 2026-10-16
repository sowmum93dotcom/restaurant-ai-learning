import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: reuse one Prisma Client across hot reloads in
// development, instead of creating a new one (and new DB connections) on
// every file change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
