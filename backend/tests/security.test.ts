import { afterAll, describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { env, envSchema } from "../src/config/env";
import { createAccessToken, decodeAccessToken } from "../src/utils/tokens";
import { parseId, publicShare } from "../src/utils/validation";
import { validateAndReadUpload, buildCloudinaryPublicId } from "../src/services/files";
import { malwareScanner } from "../src/services/malware";
import { prisma } from "../src/lib/prisma";
import { UserCreateSchema } from "../src/schemas/auth";
import { createSignedDownloadUrl } from "../src/services/cloudinary";

afterAll(() => prisma.$disconnect());

test("environment rejects weak keys, unsafe production origins and invalid limits", () => {
  expect(envSchema.safeParse({ ...env, JWT_SECRET_KEY: "short" }).success).toBe(false);
  expect(envSchema.safeParse({ ...env, NODE_ENV: "production" }).success).toBe(false);
  expect(envSchema.safeParse({ ...env, MAX_FILE_SIZE_MB: -1 }).success).toBe(false);
  expect(envSchema.safeParse({ ...env, JWT_ALGORITHM: "none" }).success).toBe(false);
});

test("JWT verifies signature, expiration and exact numeric subject", () => {
  expect(decodeAccessToken(createAccessToken(42))).toBe(42);
  for (const sub of ["1x", "-1", "0", "2147483648"]) {
    expect(decodeAccessToken(jwt.sign({ sub }, env.JWT_SECRET_KEY))).toBeNull();
  }
  expect(decodeAccessToken(jwt.sign({ sub: "1", exp: 1 }, env.JWT_SECRET_KEY))).toBeNull();
  expect(decodeAccessToken(jwt.sign({ sub: "1" }, "wrong-secret"))).toBeNull();
});

test("IDs reject partial parses and out of range values", () => {
  expect(parseId("42")).toBe(42);
  for (const value of ["1abc", "1.5", "0", "-1", "2147483648", ""]) expect(() => parseId(value)).toThrow();
});

test("share serialization does not expose password hashes", () => {
  const result = publicShare({ id: 1, password_hash: "secret-hash" });
  expect(result).toEqual({ id: 1, password_protected: true });
});

test("registration normalizes emails and bounds passwords", () => {
  expect(UserCreateSchema.parse({ email: " Alice@Example.com ", password: "password123" }).email).toBe("alice@example.com");
  expect(UserCreateSchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(false);
});

test("upload validation rejects unsupported, empty, large and invalid filenames", async () => {
  for (const file of [new File(["x"], "evil.exe"), new File([], "empty.txt"), new File(["x"], "a".repeat(256) + ".txt"), new File([new Uint8Array(11 * 1024 * 1024)], "large.txt")]) {
    await expect(validateAndReadUpload(file)).rejects.toThrow();
  }
  expect((await validateAndReadUpload(new File(["hello"], "hello.txt"))).extension).toBe("txt");
  await expect(validateAndReadUpload(new File(["executable"], "fake.png"))).rejects.toThrow();
  await expect(validateAndReadUpload(new File(["executable"], "fake.pdf"))).rejects.toThrow();
});

test("raw storage IDs preserve extension and signed download addresses exact asset", () => {
  expect(buildCloudinaryPublicId(1, "random.pdf")).toEndWith("random.pdf");
  expect(buildCloudinaryPublicId(1, "random.png")).toEndWith("random");
  const url = new URL(createSignedDownloadUrl("folder/random.pdf", "raw", "pdf", 2000000000));
  expect(url.searchParams.get("public_id")).toBe("folder/random.pdf");
  expect(url.searchParams.get("expires_at")).toBe("2000000000");
});

test("missing malware scanner fails closed", async () => {
  const previous = env.CLAMSCAN_PATH;
  env.CLAMSCAN_PATH = "fileshare-nonexistent-scanner";
  try { await expect(malwareScanner.scanBytes(Buffer.from("hello"))).rejects.toMatchObject({ status: 503 }); }
  finally { env.CLAMSCAN_PATH = previous; }
});

test("health, unknown routes, authentication, CORS and request limits", async () => {
  const health = await app.request("/health");
  expect(health.status).toBe(200);
  expect(health.headers.get("cache-control")).toBe("no-store");
  expect(health.headers.get("x-content-type-options")).toBe("nosniff");
  expect((await app.request("/unknown")).status).toBe(404);
  expect((await app.request("/files")).status).toBe(401);
  const cors = await app.request("/health", { headers: { Origin: "https://evil.example" } });
  expect(cors.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  expect((await app.request("/auth/login", { method: "POST", body: "x".repeat(5000) })).status).toBe(413);
});

describe.skipIf(process.env.RUN_DB_TESTS !== "true")("PostgreSQL API integration", () => {
  test("registration, login, ownership, shared rate limits and readiness", async () => {
    const email = `test-${crypto.randomUUID()}@example.com`;
    const headers = { "Content-Type": "application/json", "x-real-ip": crypto.randomUUID() };
    const password = "test-password-123";
    let userId: number | undefined;
    let fileId: number | undefined;
    let otherUserId: number | undefined;
    try {
      const registered = await app.request("/auth/register", { method: "POST", headers, body: JSON.stringify({ email, password }) });
      expect(registered.status).toBe(201);
      userId = ((await registered.json()) as { id: number }).id;
      const login = await app.request("/auth/login", { method: "POST", headers, body: JSON.stringify({ email, password }) });
      expect(login.status).toBe(200);
      const { access_token } = await login.json() as { access_token: string };
      const auth = { Authorization: `Bearer ${access_token}` };
      expect((await app.request("/auth/me", { headers: auth })).status).toBe(200);
      expect(await (await app.request("/files", { headers: auth })).json()).toEqual([]);
      expect((await app.request("/files/1abc", { headers: auth })).status).toBe(400);
      expect((await app.request("/files/2147483647", { headers: auth })).status).toBe(404);
      const file = await prisma.file.create({ data: {
        owner_id: userId!, original_filename: "test.txt", stored_filename: "test.txt",
        extension: "txt", size_bytes: 5, cloudinary_public_id: "tests/test.txt", cloudinary_resource_type: "raw",
      } });
      fileId = file.id;
      const other = await prisma.user.create({ data: { email: `other-${email}`, hashed_password: "unused" } });
      otherUserId = other.id;
      const otherAuth = { Authorization: `Bearer ${createAccessToken(other.id)}` };
      expect((await app.request(`/files/${file.id}`, { headers: otherAuth })).status).toBe(404);
      expect((await app.request(`/files/${file.id}`, { method: "DELETE", headers: otherAuth })).status).toBe(404);
      const shareResponse = await app.request(`/shares/files/${file.id}`, {
        method: "POST", headers: { ...headers, ...auth },
        body: JSON.stringify({ expires_at: new Date(Date.now() + 3600000).toISOString(), password: "share-password" }),
      });
      expect(shareResponse.status).toBe(201);
      const share = await shareResponse.json() as { id: number; token: string; password_hash?: string };
      expect(share.password_hash).toBeUndefined();
      const downloadRequest = (password: string) => app.request(`/shares/${share.token}/download`, { method: "POST", headers, body: JSON.stringify({ password }) });
      expect((await downloadRequest("wrong")).status).toBe(401);
      const download = await downloadRequest("share-password");
      expect(download.status).toBe(200);
      const data = await download.json() as { download_url: string };
      const expiry = Number(new URL(data.download_url).searchParams.get("expires_at"));
      expect(expiry).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + env.DOWNLOAD_URL_TTL_SECONDS);
      expect((await app.request(`/shares/${share.id}/revoke`, { method: "POST", headers: otherAuth })).status).toBe(404);
      const revoked = await app.request(`/shares/${share.id}/revoke`, { method: "POST", headers: auth });
      expect(revoked.status).toBe(200);
      expect(await revoked.json()).not.toHaveProperty("password_hash");
      expect((await downloadRequest("share-password")).status).toBe(404);
      expect((await app.request("/ready")).status).toBe(200);
      for (let i = 0; i < 10; i++) await app.request("/auth/login", { method: "POST", headers, body: JSON.stringify({ email, password: "wrong" }) });
      expect((await app.request("/auth/login", { method: "POST", headers, body: JSON.stringify({ email, password }) })).status).toBe(429);
    } finally {
      if (fileId) await prisma.accessLog.deleteMany({ where: { file_id: fileId } });
      if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } });
      if (userId) {
        await prisma.accessLog.deleteMany({ where: { user_id: userId } });
        await prisma.user.delete({ where: { id: userId } });
      }
    }
  }, 30000);
});
