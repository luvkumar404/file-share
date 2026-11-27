import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config({ quiet: true });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  JWT_SECRET_KEY: z.string().min(32),
  JWT_ALGORITHM: z.literal("HS256").default("HS256"),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().max(1440).default(60),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().max(100).default(10),
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  CLAMSCAN_PATH: z.string().min(1).default("clamscan"),
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().max(300000).default(60000),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(60),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === "production" && /^(replace-|test-)/i.test(value.JWT_SECRET_KEY)) {
    ctx.addIssue({ code: "custom", path: ["JWT_SECRET_KEY"], message: "Replace the example secret before deploying." });
  }
  let url: URL;
  try { url = new URL(value.FRONTEND_URL); } catch { return; }
  if (url.origin !== value.FRONTEND_URL || (value.NODE_ENV === "production" && url.protocol !== "https:")) {
    ctx.addIssue({ code: "custom", path: ["FRONTEND_URL"], message: "Use an exact origin; production requires HTTPS." });
  }
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("Invalid environment variables:", envResult.error.format());
  process.exit(1);
}

export const env = envResult.data;
export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
