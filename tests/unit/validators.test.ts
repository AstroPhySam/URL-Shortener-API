import { describe, test, expect } from "bun:test";
import { createUrlSchema, codeParamSchema } from "../../src/validators";

describe("createUrlSchema", () => {
  test("accepts https and http urls", () => {
    expect(
      createUrlSchema.safeParse({ url: "https://example.com" }).success,
    ).toBe(true);
    expect(
      createUrlSchema.safeParse({ url: "http://x.com/a?b=1" }).success,
    ).toBe(true);
  });

  test("rejects non-http(s) urls", () => {
    expect(createUrlSchema.safeParse({ url: "ftp://x.com" }).success).toBe(
      false,
    );
  });

  test("rejects missing, empty and non-url values", () => {
    expect(createUrlSchema.safeParse({}).success).toBe(false);
    expect(createUrlSchema.safeParse({ url: "" }).success).toBe(false);
    expect(createUrlSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
    expect(createUrlSchema.safeParse({ url: 123 }).success).toBe(false);
  });
});

describe("codeParamSchema", () => {
  test("accepts alphanumeric codes", () => {
    expect(codeParamSchema.safeParse({ code: "abc123" }).success).toBe(true);
  });

  test("rejects bad format and out-of-range lengths", () => {
    expect(codeParamSchema.safeParse({ code: "!!!" }).success).toBe(false);
    expect(codeParamSchema.safeParse({ code: "a/b" }).success).toBe(false);
    expect(codeParamSchema.safeParse({ code: "" }).success).toBe(false);
    expect(codeParamSchema.safeParse({ code: "a".repeat(65) }).success).toBe(
      false,
    );
  });
});
