import type { SDKImage } from "@cursor/sdk";

/** Convert an MCP tool arg (data URI or URL) into the SDK's SDKImage shape. */
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

/** Accept either a single image string or an array, from clients that pass either. */
export function normalizeImages(images: string | string[] | undefined): string[] | undefined {
  if (images === undefined) return undefined;
  return Array.isArray(images) ? images : [images];
}
