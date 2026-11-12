import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env by itself; Node's built-in loader does it (no dotenv dependency).
// In CI and on Vercel the variables come from the environment and there is no .env file.
try {
  process.loadEnvFile();
} catch {
  // no .env file: fine
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations need a direct (unpooled) connection. `prisma generate` doesn't connect, so an
  // empty value is fine there (e.g. in CI's lint job).
  datasource: {
    url:
      process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
