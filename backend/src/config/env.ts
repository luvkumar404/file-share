import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

// Only non-critical settings are validated here. Missing secrets must not crash the
// whole API on import (that surfaces as a 502 from the Netlify function), so they are
// optional and checked where they are used.
// Treat empty strings as unset.
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const envSchema = z.object({
  JWT_SECRET_KEY: optionalString,
  JWT_ALGORITHM: z.string().default("HS256"),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  FRONTEND_URL: optionalString,
  PORT: z.coerce.number().default(8000),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("Invalid environment variables:", envResult.error.format());
  throw new Error("Invalid environment variables. Check the backend configuration.");
}

export const env = envResult.data;
export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
