import { MAX_FILE_SIZE_BYTES } from "../config/env";
import { getExtension, createSafeFilename } from "../utils/tokens";
import { HTTPException } from "hono/http-exception";

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "png", "jpg", "jpeg"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

export async function validateAndReadUpload(upload: File): Promise<{ fileBytes: Buffer; extension: string; storedFilename: string }> {
  const originalFilename = upload.name || "uploaded-file";
  const extension = getExtension(originalFilename);
  if (originalFilename.length > 255 || /[\x00-\x1f\x7f]/.test(originalFilename)) {
    throw new HTTPException(400, { message: "Invalid filename." });
  }
  if (upload.size === 0 || upload.size > MAX_FILE_SIZE_BYTES) {
    throw new HTTPException(413, { message: "File is empty or exceeds the upload limit." });
  }
  
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new HTTPException(400, { message: "File type is not allowed." });
  }

  const arrayBuffer = await upload.arrayBuffer();
  const fileBytes = Buffer.from(arrayBuffer);

  const validSignature = extension === "pdf" ? fileBytes.subarray(0, 5).toString() === "%PDF-"
    : extension === "png" ? fileBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === "jpg" || extension === "jpeg" ? fileBytes[0] === 0xff && fileBytes[1] === 0xd8 && fileBytes[2] === 0xff
    : extension === "docx" ? fileBytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
    : !fileBytes.includes(0);
  if (!validSignature) {
    throw new HTTPException(400, { message: "File content does not match the allowed type." });
  }

  if (fileBytes.length > MAX_FILE_SIZE_BYTES) {
    throw new HTTPException(400, { message: `File is too large. Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` });
  }

  const storedFilename = createSafeFilename(extension);
  return { fileBytes, extension, storedFilename };
}

export function buildCloudinaryPublicId(userId: number, storedFilename: string): string {
  const filenameWithoutExtension = storedFilename.split(".").slice(0, -1).join(".");
  const name = IMAGE_EXTENSIONS.has(getExtension(storedFilename)) ? filenameWithoutExtension : storedFilename;
  return `secure_file_sharing/users/${userId}/${name}`;
}

export function getCloudinaryResourceType(extension: string): "image" | "raw" {
  if (IMAGE_EXTENSIONS.has(extension.toLowerCase())) {
    return "image";
  }
  return "raw";
}
