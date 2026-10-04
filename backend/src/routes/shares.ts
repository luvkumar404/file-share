import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { files, shareLinks, accessLogs, type User } from "../../db/schema";
import { authMiddleware } from "../middleware/auth";
import { ShareCreateSchema, PublicDownloadRequestSchema } from "../schemas/share";
import { createShareToken } from "../utils/tokens";
import { hashPassword, verifyPassword } from "../utils/security";
import { createSignedDownloadUrl } from "../services/cloudinary";

export const sharesRouter = new Hono<{ Variables: { user: User } }>();

sharesRouter.post("/files/:file_id", authMiddleware, zValidator("json", ShareCreateSchema), async (c) => {
  const user = c.get("user");
  const fileId = parseInt(c.req.param("file_id"), 10);
  const { expires_at, password } = c.req.valid("json");

  if (isNaN(fileId)) {
    return c.json({ detail: "Invalid file ID." }, 400);
  }

  const [fileRecord] = await db.select().from(files).where(eq(files.id, fileId));
  if (!fileRecord || fileRecord.owner_id !== user.id) {
    return c.json({ detail: "File not found." }, 404);
  }

  if (expires_at <= new Date()) {
    return c.json({ detail: "Expiry time must be in the future." }, 400);
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const token = createShareToken();

  const shareLink = await db.transaction(async (tx) => {
    const [share] = await tx
      .insert(shareLinks)
      .values({
        file_id: fileRecord.id,
        token,
        password_hash: passwordHash,
        expires_at,
      })
      .returning();

    await tx.insert(accessLogs).values({
      user_id: user.id,
      file_id: fileRecord.id,
      action: "share_create",
      ip_address: c.req.header("x-forwarded-for") || null,
    });

    return share;
  });

  return c.json(shareLink, 201);
});

sharesRouter.post("/:token/download", zValidator("json", PublicDownloadRequestSchema), async (c) => {
  const token = c.req.param("token");
  const { password } = c.req.valid("json");

  const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.token, token));
  if (!shareLink || shareLink.is_revoked || shareLink.expires_at <= new Date()) {
    return c.json({ detail: "Share link is invalid or expired." }, 404);
  }

  if (shareLink.password_hash) {
    if (!password) {
      return c.json({ detail: "Invalid share password." }, 401);
    }
    const isValid = await verifyPassword(password, shareLink.password_hash);
    if (!isValid) {
      return c.json({ detail: "Invalid share password." }, 401);
    }
  }

  const [fileRecord] = await db.select().from(files).where(eq(files.id, shareLink.file_id));
  if (!fileRecord) {
    return c.json({ detail: "File not found." }, 404);
  }

  const downloadUrl = createSignedDownloadUrl(
    fileRecord.cloudinary_public_id,
    fileRecord.cloudinary_resource_type,
    fileRecord.extension,
    Math.floor(shareLink.expires_at.getTime() / 1000)
  );

  await db.insert(accessLogs).values({
    file_id: fileRecord.id,
    action: "download",
    ip_address: c.req.header("x-forwarded-for") || null,
  });

  return c.json({
    file_name: fileRecord.original_filename,
    download_url: downloadUrl,
  });
});

sharesRouter.post("/:share_id/revoke", authMiddleware, async (c) => {
  const user = c.get("user");
  const shareId = parseInt(c.req.param("share_id") ?? "", 10);

  if (isNaN(shareId)) {
    return c.json({ detail: "Invalid share ID." }, 400);
  }

  const [row] = await db
    .select({ share: shareLinks, ownerId: files.owner_id })
    .from(shareLinks)
    .innerJoin(files, eq(shareLinks.file_id, files.id))
    .where(eq(shareLinks.id, shareId));
  if (!row || row.ownerId !== user.id) {
    return c.json({ detail: "Share link not found." }, 404);
  }

  const [updatedShare] = await db
    .update(shareLinks)
    .set({ is_revoked: true })
    .where(eq(shareLinks.id, shareId))
    .returning();

  return c.json(updatedShare);
});
