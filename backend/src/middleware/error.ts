import { Prisma } from "@prisma/client";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json({ detail: err.message }, err.status);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return c.json({ detail: "Record already exists." }, 409);
  }
  console.error("Request failed", { requestId: c.res.headers.get("X-Request-Id"), error: err.name });
  return c.json({ detail: "Internal Server Error" }, 500);
}
