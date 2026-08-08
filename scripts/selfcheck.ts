import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeImages, toSdkImage, toSdkImageAsync } from "../src/images.js";

// data URI → { data, mimeType }
assert.deepEqual(
  toSdkImage("data:image/png;base64,iVBORw0KGgo="),
  { data: "iVBORw0KGgo=", mimeType: "image/png" },
);

// parameterized data URI (valid per RFC 2397) is accepted, media type preserved
assert.deepEqual(
  toSdkImage("data:image/png;charset=utf-8;base64,iVBORw0KGgo="),
  { data: "iVBORw0KGgo=", mimeType: "image/png" },
);

// scheme and base64 keyword are case-insensitive
assert.deepEqual(
  toSdkImage("DATA:image/png;BASE64,iVBORw0KGgo="),
  { data: "iVBORw0KGgo=", mimeType: "image/png" },
);

// empty media type falls back to text/plain
assert.deepEqual(toSdkImage("data:;base64,SGVsbG8="), { data: "SGVsbG8=", mimeType: "text/plain" });

// non-base64 data URI is rejected
assert.throws(() => toSdkImage("data:image/png,iVBORw0KGgo="), /expected data:<mime>;base64/);

// http(s) URL → { url }
assert.deepEqual(toSdkImage("https://example.com/a.png"), { url: "https://example.com/a.png" });

// anything else rejected
assert.throws(() => toSdkImage("/tmp/a.png"), /data URI.*or an http\(s\) URL/);

// images accepts single string or array
assert.deepEqual(normalizeImages("data:image/png;base64,x"), ["data:image/png;base64,x"]);
assert.deepEqual(normalizeImages(["a", "b"]), ["a", "b"]);
assert.equal(normalizeImages(undefined), undefined);

// local image file path → read as base64, mime from extension
const dir = await mkdtemp(path.join(tmpdir(), "images-handler-"));
try {
  const png = path.join(dir, "test.png");
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await writeFile(png, bytes);
  assert.deepEqual(await toSdkImageAsync(png), { data: bytes.toString("base64"), mimeType: "image/png" });

  // non-image file type rejected
  const txt = path.join(dir, "notes.txt");
  await writeFile(txt, "hello");
  await assert.rejects(toSdkImageAsync(txt), /unsupported file type/);

  // data URI / URL still route through the same entry point
  assert.deepEqual(await toSdkImageAsync("data:image/png;base64,iVBORw0KGgo="), {
    data: "iVBORw0KGgo=",
    mimeType: "image/png",
  });
  assert.deepEqual(await toSdkImageAsync("https://example.com/a.png"), { url: "https://example.com/a.png" });
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("selfcheck OK");
