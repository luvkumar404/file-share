import { rateLimit } from "../middleware/rate-limit";
import { parseId } from "../utils/validation";
import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import type { User } from "@prisma/client";
import { malwareScanner } from "../services/malware";
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "../services/cloudinary";
import { validateAndReadUpload, buildCloudinaryPublicId, getCloudinaryResourceType } from "../services/files";

export const filesRouter = new Hono<{ Variables: { user: User } }>();

filesRouter.use("*", authMiddleware);

filesRouter.post("/", rateLimit("upload", 10, 300), async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const upload = body["upload"];

  if (!(upload instanceof File)) {
    return c.json({ detail: "Invalid file upload." }, 400);
  }

  const { fileBytes, extension, storedFilename } = await validateAndReadUpload(upload);

  const scanResult = await malwareScanner.scanBytes(fileBytes);
  if (!scanResult.is_clean) {
    return c.json({ detail: scanResult.message }, 400);
  }

  const publicId = buildCloudinaryPublicId(user.id, storedFilename);
  const resourceType = getCloudinaryResourceType(extension);
  const uploadResult = await uploadFileToCloudinary(fileBytes, publicId, resourceType);

  let fileRecord;
  try {
    fileRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.file.create({
        data: {
          owner_id: user.id,
          original_filename: upload.name || "uploaded-file",
          stored_filename: storedFilename,
          extension,
        content_type: ({ pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" } as Record<string, string>)[extension],
          size_bytes: fileBytes.length,
          cloudinary_public_id: uploadResult.public_id,
          cloudinary_resource_type: uploadResult.resource_type,
        },
      });

      await tx.accessLog.create({
        data: {
          user_id: user.id,
          file_id: record.id,
          action: "upload",
          ip_address: c.req.header("x-real-ip")?.slice(0, 100) || null,
        },
      });

      return record;
    });

  } catch (error) {
    await deleteFileFromCloudinary(uploadResult.public_id, uploadResult.resource_type).catch(() => console.error("Orphaned upload requires cleanup", { publicId: uploadResult.public_id }));
    throw error;
  }
  return c.json(fileRecord, 201);
});

filesRouter.get("/", async (c) => {
  const user = c.get("user");
  const offset = Number(c.req.query("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return c.json({ detail: "Invalid offset." }, 400);
  const files = await prisma.file.findMany({
    where: { owner_id: user.id },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 100,
    skip: offset,
  });
  return c.json(files);
});

filesRouter.get("/:file_id", async (c) => {
  const user = c.get("user");
  const fileId = parseId(c.req.param("file_id"));

  const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });
  if (!fileRecord || fileRecord.owner_id !== user.id) {
    return c.json({ detail: "File not found." }, 404);
  }

  return c.json(fileRecord);
});

filesRouter.delete("/:file_id", async (c) => {
  const user = c.get("user");
  const fileId = parseId(c.req.param("file_id"));

  const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });
  if (!fileRecord || fileRecord.owner_id !== user.id) {
    return c.json({ detail: "File not found." }, 404);
  }

  await deleteFileFromCloudinary(fileRecord.cloudinary_public_id, fileRecord.cloudinary_resource_type);

  await prisma.$transaction(async (tx) => {
    await tx.accessLog.create({
      data: {
        user_id: user.id,
        file_id: fileRecord.id,
        action: "delete",
        ip_address: c.req.header("x-real-ip")?.slice(0, 100) || null,
      },
    });
    await tx.file.delete({ where: { id: fileRecord.id } });
  });

  return new Response(null, { status: 204 });
});
