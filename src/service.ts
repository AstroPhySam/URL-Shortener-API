import { eq } from "drizzle-orm";
import { urls, type Url } from "./db/schema";
import type { db as realDb } from "./db/index";
import {
  generateShortCode as defaultGen,
  normalizeUrl,
  isUniqueViolation,
  CodeExhaustedError,
} from "./utils";

type Db = typeof realDb;
type Deps = { db: Db; generateCode?: (len: number) => string };

const MAX_ATTEMPTS = 5;

export async function createShortUrl(
  rawUrl: string,
  { db, generateCode = defaultGen }: Deps,
): Promise<Url> {
  const originalUrl = normalizeUrl(rawUrl);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const [row] = await db
        .insert(urls)
        .values({ originalUrl, shortCode: generateCode(6) })
        .returning();
      return row;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new CodeExhaustedError();
}

export async function getUrlByCode(
  code: string,
  { db }: Pick<Deps, "db">,
): Promise<Url | null> {
  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);
  return row ?? null;
}
