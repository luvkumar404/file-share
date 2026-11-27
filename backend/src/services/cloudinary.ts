import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadFileToCloudinary(
  fileBytes: Buffer,
  publicId: string,
  resourceType: "image" | "raw"
): Promise<{ public_id: string; resource_type: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        timeout: 60000,
        type: "authenticated",
      },
      (error, result) => {
        if (error) return reject(error);
        if (result) {
          resolve({
            public_id: result.public_id,
            resource_type: result.resource_type,
          });
        } else reject(new Error("Storage returned no upload result"));
      }
    );
    uploadStream.end(fileBytes);
  });
}

export async function deleteFileFromCloudinary(
  publicId: string,
  resourceType: string
): Promise<void> {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    invalidate: true,
  });
  if (result.result !== "ok" && result.result !== "not found") throw new Error("Storage deletion failed");
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
  const cleanPublicId = resourceType === "raw" ? publicId : removeExtensionFromPublicId(publicId, extension);
  return cloudinary.utils.private_download_url(
    cleanPublicId,
    resourceType === "raw" ? "" : extension.toLowerCase(),
    {
      resource_type: resourceType,
      type: "authenticated",
      expires_at: expiresAt,
      attachment: true,
    }
  );
}
