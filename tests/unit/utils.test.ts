import { describe, test, expect } from "bun:test";
import {
  generateShortCode,
  normalizeUrl,
  isUniqueViolation,
  CodeExhaustedError,
} from "../../src/utils";

describe("generateShortCode", () => {
  test("defaults to length 6", () => {
    expect(generateShortCode()).toHaveLength(6);
  });

  test("respects custom length", () => {
    expect(generateShortCode(10)).toHaveLength(10);
  });

  test("only emits alphanumeric chars", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShortCode()).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  test("produces unique codes", () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => generateShortCode()),
    );
    expect(codes.size).toBe(1000);
  });
});

describe("normalizeUrl", () => {
  test("trims whitespace and normalizes", () => {
    expect(normalizeUrl(" https://example.com ")).toBe("https://example.com/");
  });

  test("preserves path and query", () => {
    expect(normalizeUrl("http://x.com/a?b=1")).toBe("http://x.com/a?b=1");
  });

  test("throws on garbage input", () => {
    expect(() => normalizeUrl("not a url")).toThrow();
  });
});

describe("isUniqueViolation", () => {
  test("true for direct pg code", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  test("true for wrapped driver error", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  test("false for other codes and values", () => {
    expect(isUniqueViolation({ code: "23514" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("CodeExhaustedError", () => {
  test("carries name, message and instanceof", () => {
    const err = new CodeExhaustedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CodeExhaustedError);
    expect(err.name).toBe("CodeExhaustedError");
    expect(err.message).toBe("Failed to generate unique code, try again");
  });
});
