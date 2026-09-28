import { zValidator } from "@hono/zod-validator";
import z from "zod";

export const createUrlSchema = z.object({
  url: z
    .url()
    .refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
      error: "Invalid URL. Must be http(s) URL",
    }),
});

export const codeParamSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9]+$/),
});

export const createUrlValidator = zValidator(
  "json",
  createUrlSchema,
  (r, c) => {
    if (!r.success)
      return c.json(
        { error: r.error.issues[0]?.message ?? "Invalid request" },
        400,
      );
  },
);

export const codeParamValidator = zValidator(
  "param",
  codeParamSchema,
  (r, c) => {
    if (!r.success) return c.json({ error: "Invalid code format" }, 400);
  },
);
