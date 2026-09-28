import { drizzle } from "drizzle-orm/bun-sql";
export * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export const db = drizzle(process.env.DATABASE_URL);
