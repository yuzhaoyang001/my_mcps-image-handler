import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SDKImage } from "@cursor/sdk";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

/** Convert a data URI (base64) or http(s) URL into the SDK's SDKImage shape. */
export function toSdkImage(image: string): SDKImage {
  if (image.toLowerCase().startsWith("data:")) {
    const comma = image.indexOf(",");
    if (comma === -1) throw new Error("invalid image data URI: missing base64 payload");
    // head = everything between "data:" and "," — mediatype (may carry
    // parameters) plus the ";base64" keyword, e.g. "image/png;charset=utf-8;base64".
    const head = image.slice(5, comma);
    if (!/;base64$/i.test(head)) throw new Error("invalid image data URI: expected data:<mime>;base64,...");
    const mimeType = head.split(";")[0] || "text/plain";
    return { data: image.slice(comma + 1), mimeType };
  }
  if (/^https?:\/\//i.test(image)) return { url: image };
  throw new Error("image must be a data URI (data:image/png;base64,...) or an http(s) URL");
}

/**
 * Convert an MCP tool arg (data URI, http(s) URL, or local image file path)
 * into an SDKImage. Local files are read from the machine running the server;
 * only known image extensions are accepted.
 */
export async function toSdkImageAsync(image: string): Promise<SDKImage> {
  if (image.toLowerCase().startsWith("data:") || /^https?:\/\//i.test(image)) {
    return toSdkImage(image);
  }
  const mimeType = IMAGE_MIME_BY_EXT[path.extname(image).toLowerCase()];
  if (!mimeType) throw new Error(`unsupported file type: ${image} (expected an image file)`);
  const data = await readFile(image, "base64");
  return { data, mimeType };
}

/** Accept either a single image string or an array, from clients that pass either. */
export function normalizeImages(images: string | string[] | undefined): string[] | undefined {
  if (images === undefined) return undefined;
  return Array.isArray(images) ? images : [images];
}
