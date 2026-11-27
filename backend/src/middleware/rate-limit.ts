import type { MiddlewareHandler } from "hono";

// Client address limits are shared across replicas through PostgreSQL.
import { prisma } from "../lib/prisma";
import { createHash } from "node:crypto";

export function rateLimit(scope: string, limit: number, windowSeconds = 60): MiddlewareHandler {
  return async (c, next) => {
    // Nginx must overwrite this header; the backend must not be publicly reachable.
    const address = c.req.header("x-real-ip") || "direct";
    const key = createHash("sha256").update(`${scope}:${address}`).digest("hex");
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limits (key, bucket, count) VALUES (${key}, ${bucket}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.bucket = EXCLUDED.bucket THEN rate_limits.count + 1 ELSE 1 END,
        bucket = EXCLUDED.bucket
      RETURNING count`;
    if ((rows[0]?.count ?? limit + 1) > limit) {
      c.header("Retry-After", String(windowSeconds));
      return c.json({ detail: "Too many requests. Try again later." }, 429);
    }
    await next();
  };
}
