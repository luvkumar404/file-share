import type { Context, Next } from "hono";
import { decodeAccessToken } from "../utils/tokens";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  const token = authHeader.substring(7);
  const userId = await decodeAccessToken(token);

  if (!userId) {
    return c.json({ detail: "Invalid or expired token." }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user || !user.is_active) {
    return c.json({ detail: "User not found or inactive." }, 401);
  }

  c.set("user", user);
  await next();
}
