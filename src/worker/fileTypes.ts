import type { ProcessingKind, StoredUploadForProcessing } from "./types.js";

const IMAGE_EXTENSIONS = new Set([
  ".bmp",
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);

export function getProcessingKind(upload: Pick<
  StoredUploadForProcessing,
  "telegramFileType" | "mimeType" | "originalFileName" | "objectKey"
>): ProcessingKind {
  if (isPdfUpload(upload)) {
    return "pdf";
  }

  if (isImageUpload(upload)) {
    return "image";
  }

  return "unsupported";
}

export function isPdfUpload(upload: Pick<
  StoredUploadForProcessing,
  "mimeType" | "originalFileName" | "objectKey"
>): boolean {
  return (
    upload.mimeType?.toLowerCase() === "application/pdf" ||
    getFileExtension(upload.originalFileName ?? upload.objectKey).toLowerCase() === ".pdf"
  );
}

export function isImageUpload(upload: Pick<
  StoredUploadForProcessing,
  "telegramFileType" | "mimeType" | "originalFileName" | "objectKey"
>): boolean {
  const mimeType = upload.mimeType?.toLowerCase() ?? "";
  if (upload.telegramFileType === "photo" || mimeType.startsWith("image/")) {
    return true;
  }

  return IMAGE_EXTENSIONS.has(getFileExtension(upload.originalFileName ?? upload.objectKey).toLowerCase());
}

export function getFileExtension(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const name = value.replace(/\\/g, "/").split("/").at(-1) ?? "";
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}
