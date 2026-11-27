import { env } from "../config/env";
import { rateLimit } from "../middleware/rate-limit";
import { parseId, publicShare } from "../utils/validation";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import type { User } from "@prisma/client";
import { ShareCreateSchema, PublicDownloadRequestSchema } from "../schemas/share";
import { createShareToken } from "../utils/tokens";
import { hashPassword, verifyPassword } from "../utils/security";
import { createSignedDownloadUrl } from "../services/cloudinary";

export const sharesRouter = new Hono<{ Variables: { user: User } }>();

sharesRouter.post("/files/:file_id", authMiddleware, zValidator("json", ShareCreateSchema), async (c) => {
  const user = c.get("user");
  const fileId = parseId(c.req.param("file_id"));
  const { expires_at, password } = c.req.valid("json");

  const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });
  if (!fileRecord || fileRecord.owner_id !== user.id) {
    return c.json({ detail: "File not found." }, 404);
  }

  if (expires_at <= new Date()) {
    return c.json({ detail: "Expiry time must be in the future." }, 400);
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const token = createShareToken();

  const shareLink = await prisma.$transaction(async (tx) => {
    const share = await tx.shareLink.create({
      data: {
        file_id: fileRecord.id,
        token,
        password_hash: passwordHash,
        expires_at,
      },
    });

    await tx.accessLog.create({
      data: {
        user_id: user.id,
        file_id: fileRecord.id,
        action: "share_create",
        ip_address: c.req.header("x-real-ip")?.slice(0, 100) || null,
      },
    });

    return share;
  });

  return c.json(publicShare(shareLink), 201);
});

sharesRouter.post("/:token/download", rateLimit("download", 20), zValidator("json", PublicDownloadRequestSchema), async (c) => {
  const token = c.req.param("token");
  const { password } = c.req.valid("json");
  if (!/^[a-f0-9]{64}$/.test(token)) return c.json({ detail: "Invalid share link." }, 404);

  const shareLink = await prisma.shareLink.findUnique({ where: { token } });
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

  const fileRecord = await prisma.file.findUnique({ where: { id: shareLink.file_id } });
  if (!fileRecord) {
    return c.json({ detail: "File not found." }, 404);
  }

  const downloadUrl = createSignedDownloadUrl(
    fileRecord.cloudinary_public_id,
    fileRecord.cloudinary_resource_type,
    fileRecord.extension,
    Math.min(Math.floor(shareLink.expires_at.getTime() / 1000), Math.floor(Date.now() / 1000) + env.DOWNLOAD_URL_TTL_SECONDS)
  );

  await prisma.accessLog.create({
    data: {
      file_id: fileRecord.id,
      action: "download",
      ip_address: c.req.header("x-real-ip")?.slice(0, 100) || null,
    },
  });

  return c.json({
    file_name: fileRecord.original_filename,
    download_url: downloadUrl,
  });
});

sharesRouter.post("/:share_id/revoke", authMiddleware, async (c) => {
  const user = c.get("user");
  const shareId = parseId(c.req.param("share_id") ?? "");

  const shareLink = await prisma.shareLink.findUnique({ where: { id: shareId }, include: { file: true } });
  if (!shareLink || shareLink.file.owner_id !== user.id) {
    return c.json({ detail: "Share link not found." }, 404);
  }

  const updatedShare = await prisma.shareLink.update({
    where: { id: shareId },
    data: { is_revoked: true },
  });

  return c.json(publicShare(updatedShare));
});
