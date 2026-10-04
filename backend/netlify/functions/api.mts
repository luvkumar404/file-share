import { Hono } from "hono";
import app from "../../src/app";

// Serve the Hono API under /api on the same origin as the frontend.
const api = new Hono().basePath("/api").route("/", app);

export default async (req: Request) => api.fetch(req);

export const config = {
  path: "/api/*",
};
