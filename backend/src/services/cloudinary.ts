import { v2 as cloudinary } from "cloudinary";
import { HTTPException } from "hono/http-exception";
import { env } from "../config/env";

let configured = false;

// Configure lazily so a missing Cloudinary setup only affects file operations, not the whole API.
function ensureCloudinary() {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new HTTPException(503, { message: "File storage is not configured. Set the Cloudinary environment variables." });
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export async function uploadFileToCloudinary(
  fileBytes: Buffer,
  publicId: string,
  resourceType: "image" | "raw"
): Promise<{ public_id: string; resource_type: string }> {
  ensureCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        type: "authenticated",
      },
      (error, result) => {
        if (error) return reject(error);
        if (result) {
          resolve({
            public_id: result.public_id,
            resource_type: result.resource_type,
          });
        }
      }
    );
    uploadStream.end(fileBytes);
  });
}

export async function deleteFileFromCloudinary(
  publicId: string,
  resourceType: string
): Promise<void> {
  ensureCloudinary();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    invalidate: true,
  });
}

function removeExtensionFromPublicId(publicId: string, extension: string): string {
  const suffix = `.${extension.toLowerCase()}`;
  if (publicId.toLowerCase().endsWith(suffix)) {
    return publicId.slice(0, -suffix.length);
  }
  return publicId;
}

export function createSignedDownloadUrl(
  publicId: string,
  resourceType: string,
  extension: string,
  expiresAt: number
): string {
  ensureCloudinary();
  const cleanPublicId = removeExtensionFromPublicId(publicId, extension);
  return cloudinary.utils.private_download_url(
    cleanPublicId,
    extension.toLowerCase(),
    {
      resource_type: resourceType,
      type: "authenticated",
      expires_at: expiresAt,
      attachment: true,
    }
  );
}
