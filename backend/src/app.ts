import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { requestId } from "hono/request-id";
import { prisma } from "./lib/prisma";
import { MAX_FILE_SIZE_BYTES } from "./config/env";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { filesRouter } from "./routes/files";
import { sharesRouter } from "./routes/shares";
import { errorHandler } from "./middleware/error";

const app = new Hono();

app.use("*", requestId());
app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  const started = Date.now();
  await next();
  // Share tokens and query strings must never enter request logs.
  console.info(JSON.stringify({ requestId: c.get("requestId"), method: c.req.method, status: c.res.status, durationMs: Date.now() - started }));
});
app.use("*", bodyLimit({
  maxSize: MAX_FILE_SIZE_BYTES + 64 * 1024,
  onError: (c) => c.json({ detail: "Request too large." }, 413),
}));
app.use("/auth/*", bodyLimit({ maxSize: 4096, onError: (c) => c.json({ detail: "Request too large." }, 413) }));
app.use("/shares/*", bodyLimit({ maxSize: 4096, onError: (c) => c.json({ detail: "Request too large." }, 413) }));
app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.onError(errorHandler);

app.notFound((c) => c.json({ detail: "Not found." }, 404));

app.route("/auth", authRouter);
app.route("/files", filesRouter);
app.route("/shares", sharesRouter);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/ready", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "unavailable" }, 503);
  }
});

export default app;
