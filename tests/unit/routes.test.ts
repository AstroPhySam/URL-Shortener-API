import {
  describe,
  test,
  expect,
  beforeEach,
  afterAll,
  mock,
  spyOn,
} from "bun:test";

// Offline route tests: real validators + real service, only the drizzle
// query chain is stubbed. Nothing here needs DATABASE_URL or Postgres.
// We mock the db module (not the service module) so this mock can't leak
// into service.test.ts, which needs the real service.

let insertImpl: () => Promise<any[]>;
let selectImpl: () => Promise<any[]>;
const calls = { insert: 0, select: 0 };

const defaultInsert = async () => [
  {
    id: "00000000-0000-0000-0000-000000000000",
    originalUrl: "https://example.com/",
    shortCode: "ABC123",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
];

const defaultSelect = async () => [
  {
    id: "00000000-0000-0000-0000-000000000000",
    originalUrl: "https://example.com/",
    shortCode: "ABC123",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
];

mock.module("../../src/db/index", () => ({
  db: {
    insert: () => ({
      values: () => ({ returning: () => (calls.insert++, insertImpl()) }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => (calls.select++, selectImpl()) }),
      }),
    }),
  },
}));

const { app } = await import("../../src/index");

const pgUnique = () =>
  Object.assign(new Error("duplicate key value"), { code: "23505" });

beforeEach(() => {
  // Mute the expected console.error from the app onError handler.
  spyOn(console, "error").mockImplementation(() => {});
  insertImpl = defaultInsert;
  selectImpl = defaultSelect;
  calls.insert = 0;
  calls.select = 0;
});

// Keep the registry clean for integration files loaded after this one.
afterAll(() => {
  mock.restore();
});

const postGenerate = (body: unknown) =>
  app.request("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /generate", () => {
  test("201 with shortCode, shortUrl and originalUrl", async () => {
    const res = await postGenerate({ url: "https://example.com" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.shortCode).toBe("ABC123");
    expect(body.originalUrl).toBe("https://example.com/");
    expect(body.shortUrl.endsWith("/ABC123")).toBe(true);
    expect(calls.insert).toBe(1);
  });

  test("400 on invalid body without touching the db", async () => {
    const res = await postGenerate({ url: "not-a-url" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeString();
    expect(calls.insert).toBe(0);
  });

  test("201 after one collision (insert → 23505 → insert)", async () => {
    let n = 0;
    insertImpl = async () =>
      ++n === 1 ? Promise.reject(pgUnique()) : defaultInsert();
    const res = await postGenerate({ url: "https://example.com" });
    expect(res.status).toBe(201);
    expect((await res.json()).shortCode).toBe("ABC123");
    expect(calls.insert).toBe(2);
  });

  test("500 with retry message when codes are exhausted", async () => {
    insertImpl = () => Promise.reject(pgUnique());
    const res = await postGenerate({ url: "https://example.com" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Failed to generate unique code, try again",
    });
    expect(calls.insert).toBe(5);
  });

  test("500 generic json on unexpected db errors", async () => {
    insertImpl = () =>
      Promise.reject(
        Object.assign(new Error("db down"), { code: "ECONNREFUSED" }),
      );
    const res = await postGenerate({ url: "https://example.com" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});

describe("GET /urls/:code", () => {
  test("200 with details when found", async () => {
    const res = await app.request("/urls/ABC123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shortCode).toBe("ABC123");
    expect(body.originalUrl).toBe("https://example.com/");
    expect(body.createdAt).toBeString();
  });

  test("404 when missing", async () => {
    selectImpl = async () => [];
    const res = await app.request("/urls/NOPE99");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Short URL not found" });
  });

  test("400 on invalid code format", async () => {
    const res = await app.request("/urls/!!!");
    expect(res.status).toBe(400);
    expect(calls.select).toBe(0);
  });
});

describe("GET /:code", () => {
  test("302 redirect to the original url", async () => {
    const res = await app.request("/ABC123", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/");
  });

  test("404 when missing", async () => {
    selectImpl = async () => [];
    const res = await app.request("/NOPE99");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Short URL not found" });
  });
});
