import { describe, test, expect } from "bun:test";
import { app } from "../../src/index";
import { generateShortCode } from "../../src/utils";

// Real-Postgres workflow test. No flags, no cleanup: each test operates on
// its own rows (server-generated codes, or a verified-absent code below),
// so residue from previous runs is harmless and no truncate is needed.
//
// Local (needs Postgres up):
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/url_shortener_test bun run db:push
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/url_shortener_test bun test tests/integration
//
// CI (.github/workflows/ci.yml) injects DATABASE_URL deterministically.
// Offline unit tests live in tests/unit and never touch the database.

async function findAbsentCode(): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const code = generateShortCode();
    const res = await app.request(`/urls/${code}`);
    if (res.status === 404) return code;
  }
  throw new Error("could not find an absent code");
}

describe("urls integration (real Postgres)", () => {
  test("POST /generate → GET /urls/:code → GET /:code", async () => {
    const created = await app.request("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(created.status).toBe(201);

    const { shortCode, shortUrl, originalUrl } = await created.json();
    expect(shortCode).toHaveLength(6);
    expect(shortUrl.endsWith(`/${shortCode}`)).toBe(true);
    expect(originalUrl).toBe("https://example.com/");

    const details = await app.request(`/urls/${shortCode}`);
    expect(details.status).toBe(200);
    expect(await details.json()).toMatchObject({ shortCode, originalUrl });

    const redirect = await app.request(`/${shortCode}`, { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe(originalUrl);
  });

  test("unknown codes return 404", async () => {
    const code = await findAbsentCode();

    const details = await app.request(`/urls/${code}`);
    expect(details.status).toBe(404);

    const redirect = await app.request(`/${code}`);
    expect(redirect.status).toBe(404);
  });
});
