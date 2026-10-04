import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../../db";
import { appSecrets } from "../../db/schema";

const JWT_SECRET_NAME = "jwt_secret_key";
let cachedJwtSecret: string | undefined;

// Prefer JWT_SECRET_KEY; otherwise use a random key generated once and persisted in the
// database so tokens stay valid across function instances and deploys.
async function getJwtSecret(): Promise<string> {
  if (env.JWT_SECRET_KEY) return env.JWT_SECRET_KEY;
  if (cachedJwtSecret) return cachedJwtSecret;

  await db
    .insert(appSecrets)
    .values({ name: JWT_SECRET_NAME, value: randomBytes(64).toString("hex") })
    .onConflictDoNothing();
  const [row] = await db.select().from(appSecrets).where(eq(appSecrets.name, JWT_SECRET_NAME));
  if (!row) throw new Error("Unable to load JWT signing key.");

  cachedJwtSecret = row.value;
  return cachedJwtSecret;
}

export function createShareToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSafeFilename(extension: string): string {
  const randomName = randomBytes(16).toString("hex");
  return `${randomName}.${extension}`;
}

export function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? "") : "";
}

export async function createAccessToken(userId: number): Promise<string> {
  const payload = { sub: userId.toString() };
  return jwt.sign(payload, await getJwtSecret(), {
    algorithm: env.JWT_ALGORITHM as jwt.Algorithm,
    expiresIn: `${env.ACCESS_TOKEN_EXPIRE_MINUTES}m`,
  });
}

export async function decodeAccessToken(token: string): Promise<number | null> {
  const secret = await getJwtSecret();
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: [env.JWT_ALGORITHM as jwt.Algorithm],
    }) as jwt.JwtPayload;
    if (payload.sub) {
      return parseInt(payload.sub, 10);
    }
    return null;
  } catch (error) {
    return null;
  }
}
