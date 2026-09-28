import { Hono } from "hono";
import { codeParamValidator, createUrlValidator } from "./validators";
import { db } from "./db";
import { createShortUrl, getUrlByCode } from "./service";
import { CodeExhaustedError } from "./utils";

export const urlsRoute = new Hono();

urlsRoute.post("/generate", createUrlValidator, async (c) => {
  const { url } = c.req.valid("json");
  try {
    const row = await createShortUrl(url, { db });
    return c.json(
      {
        shortCode: row.shortCode,
        shortUrl: `${new URL(c.req.url).origin}/${row.shortCode}`,
        originalUrl: row.originalUrl,
      },
      201,
    );
  } catch (e) {
    if (e instanceof CodeExhaustedError)
      return c.json({ error: e.message }, 500);
    throw e;
  }
});

urlsRoute.get("/urls/:code", codeParamValidator, async (c) => {
  const { code } = c.req.valid("param");
  const row = await getUrlByCode(code, { db });
  if (!row) return c.json({ error: "Short URL not found" }, 404);
  return c.json({
    shortCode: row.shortCode,
    originalUrl: row.originalUrl,
    createdAt: row.createdAt,
  });
});

urlsRoute.get("/:code", codeParamValidator, async (c) => {
  const { code } = c.req.valid("param");
  const row = await getUrlByCode(code, { db });
  if (!row) return c.json({ error: "Short URL not found" }, 404);
  return c.redirect(row.originalUrl, 302);
});
