import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// One client per server instance. In dev, Next.js hot reload re-imports modules, so the client
// is kept on globalThis to avoid opening a new connection pool on every reload.
const globalForPrisma = globalThis as unknown as { agniPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Small pool: serverless instances are many and short-lived; Neon's pooler does the rest.
  const adapter = new PrismaPg({ connectionString, max: 3 });
  return new PrismaClient({ adapter });
}

/** Lazily created so that importing this module never needs the database (e.g. during build). */
export function getDb(): PrismaClient {
  globalForPrisma.agniPrisma ??= createClient();
  return globalForPrisma.agniPrisma;
}
