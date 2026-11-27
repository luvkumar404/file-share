import app from "./src/app";
import { env, MAX_FILE_SIZE_BYTES } from "./src/config/env";
import { prisma } from "./src/lib/prisma";

const server = Bun.serve({
  port: env.PORT,
  maxRequestBodySize: MAX_FILE_SIZE_BYTES + 64 * 1024,
  idleTimeout: 120,
  fetch: app.fetch,
});
console.info(`API listening on port ${server.port}`);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 30000);
  deadline.unref();
  await server.stop();
  await prisma.$disconnect();
  clearTimeout(deadline);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
