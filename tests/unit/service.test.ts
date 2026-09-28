import { describe, test, expect } from "bun:test";
import { createShortUrl, getUrlByCode } from "../../src/service";
import { CodeExhaustedError } from "../../src/utils";

const pgUnique = () =>
  Object.assign(new Error("duplicate key value"), { code: "23505" });

function makeDb(
  steps: Array<{ row?: any; error?: unknown }>,
  calls: { insert: number },
) {
  let i = 0;
  return {
    insert: () => ({
      values: () => ({
        returning: async () => {
          calls.insert++;
          const step = steps[Math.min(i++, steps.length - 1)];
          if (step.error) throw step.error;
          return [step.row];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  };
}

function makeSelectDb(rows: any[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  };
}

const row = (shortCode: string) => ({
  id: "00000000-0000-0000-0000-000000000000",
  originalUrl: "https://example.com/",
  shortCode,
  createdAt: new Date("2026-01-01"),
});

describe("createShortUrl", () => {
  test("inserts once and returns the row", async () => {
    const calls = { insert: 0 };
    const seenLens: number[] = [];
    const created = await createShortUrl("https://example.com", {
      db: makeDb([{ row: row("ABC123") }], calls) as any,
      generateCode: (len) => {
        seenLens.push(len);
        return "ABC123";
      },
    });
    expect(created.shortCode).toBe("ABC123");
    expect(calls.insert).toBe(1);
    expect(seenLens).toEqual([6]);
  });

  test("retries once after a collision then succeeds", async () => {
    const calls = { insert: 0 };
    const queue = ["DUP111", "NEW222"];
    const created = await createShortUrl("https://example.com", {
      db: makeDb([{ error: pgUnique() }, { row: row("NEW222") }], calls) as any,
      generateCode: () => queue.shift()!,
    });
    expect(created.shortCode).toBe("NEW222");
    expect(calls.insert).toBe(2);
  });

  test("throws CodeExhaustedError after 5 collisions", async () => {
    const calls = { insert: 0 };
    const failing = createShortUrl("https://example.com", {
      db: makeDb([{ error: pgUnique() }], calls) as any,
      generateCode: () => "SAME11",
    });
    await expect(failing).rejects.toBeInstanceOf(CodeExhaustedError);
    expect(calls.insert).toBe(5);
  });

  test("rethrows non-unique db errors without retrying", async () => {
    const calls = { insert: 0 };
    const boom = Object.assign(new Error("conn refused"), {
      code: "ECONNREFUSED",
    });
    const failing = createShortUrl("https://example.com", {
      db: makeDb([{ error: boom }], calls) as any,
    });
    await expect(failing).rejects.toBe(boom);
    expect(calls.insert).toBe(1);
  });

  test("never touches the db for an invalid url", async () => {
    const calls = { insert: 0 };
    const failing = createShortUrl("not a url", {
      db: makeDb([{ row: row("XXXXXX") }], calls) as any,
    });
    await expect(failing).rejects.toThrow();
    expect(calls.insert).toBe(0);
  });
});

describe("getUrlByCode", () => {
  test("returns the row when found", async () => {
    const found = await getUrlByCode("ABC123", {
      db: makeSelectDb([row("ABC123")]) as any,
    });
    expect(found?.shortCode).toBe("ABC123");
  });

  test("returns null when missing", async () => {
    const found = await getUrlByCode("NOPE99", { db: makeSelectDb([]) as any });
    expect(found).toBeNull();
  });
});
