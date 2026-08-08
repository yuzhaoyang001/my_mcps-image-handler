import assert from "node:assert/strict";
import { normalizeImages, toSdkImage } from "../src/images.js";

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

console.log("selfcheck OK");
