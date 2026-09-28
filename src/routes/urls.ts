import { Hono } from "hono";
import { codeParamValidator, createUrlValidator } from "../validators/urls";
import { generateShortCode } from "../utils/shortCode";
import { db } from "../db";
import { urls } from "../db/schema";
import { eq } from "drizzle-orm";

export const urlsRoute = new Hono();

urlsRoute.post("/generate", createUrlValidator, async (c) => {
  const { url } = c.req.valid("json");
  const normalized = new URL(url.trim()).toString();

  let created = null;

  for (let i = 0; i < 5; i++) {
    const shortCode = generateShortCode(6);
    const [exists] = await db
      .select({ id: urls.id })
      .from(urls)
      .where(eq(urls.shortCode, shortCode))
      .limit(1);

    if (exists) continue;

    try {
      [created] = await db
        .insert(urls)
        .values({ originalUrl: normalized, shortCode })
        .returning();
      break;
    } catch {
      continue;
    }
  }

  if (!created)
    return c.json({ error: "Failed to generate unique code, try again" }, 500);

  return c.json(
    {
      shortCode: created.shortCode,
      shortUrl: `${new URL(c.req.url).origin}/${created.shortCode}`,
      originalUrl: created.originalUrl,
    },
    201,
  );
});

urlsRoute.get("/:code", codeParamValidator, async (c) => {
  const { code } = c.req.valid("param");

  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!row) return c.json({ error: "Short URL not found" }, 404);

  return c.redirect(row.originalUrl, 302);
});

urlsRoute.get("/urls/:code", codeParamValidator, async (c) => {
  const { code } = c.req.valid("param");

  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!row) return c.json({ error: "Short URL not found" }, 404);

  return c.json({
    shortCode: row.shortCode,
    originalUrl: row.originalUrl,
    createdAt: row.createdAt,
  });
});
