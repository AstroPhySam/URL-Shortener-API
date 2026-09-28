const ALPHANUM =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateShortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[bytes[i] % ALPHANUM.length];
  }
  return out;
}

export function normalizeUrl(raw: string): string {
  return new URL(raw.trim()).toString();
}

export function isUniqueViolation(e: unknown): boolean {
  const code = (e as any)?.code ?? (e as any)?.cause?.code;
  return code === "23505";
}

export class CodeExhaustedError extends Error {
  constructor() {
    super("Failed to generate unique code, try again");
    this.name = "CodeExhaustedError";
  }
}
