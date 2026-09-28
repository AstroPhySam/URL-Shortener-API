import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const urls = pgTable("urls", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalUrl: text("original_url").notNull(),
  shortCode: text("short_code").notNull().unique(),
  createdAt: timestamp("timestamp").defaultNow().notNull(),
});

export type Url = typeof urls.$inferSelect;
export type NewUrl = typeof urls.$inferInsert;
