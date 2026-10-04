import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { filesRouter } from "./routes/files";
import { sharesRouter } from "./routes/shares";
import { errorHandler } from "./middleware/error";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    // The frontend is served from the same origin on Netlify; FRONTEND_URL is only needed for split local dev.
    origin: env.FRONTEND_URL ?? ((origin) => origin),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.onError(errorHandler);

app.route("/auth", authRouter);
app.route("/files", filesRouter);
app.route("/shares", sharesRouter);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
