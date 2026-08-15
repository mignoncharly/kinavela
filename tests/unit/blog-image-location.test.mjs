import { describe, expect, it } from "vitest";

import { hasLocationMetadata } from "../../scripts/lib/image-location.mjs";

/** Builds a TIFF block whose IFD optionally carries the GPS IFD pointer. */
function tiffBlock({ gps, littleEndian }) {
  const entries = [];
  const entry = (tag, type, count, value) => {
    const buffer = Buffer.alloc(12);
    if (littleEndian) {
      buffer.writeUInt16LE(tag, 0);
      buffer.writeUInt16LE(type, 2);
      buffer.writeUInt32LE(count, 4);
      buffer.writeUInt32LE(value, 8);
    } else {
      buffer.writeUInt16BE(tag, 0);
      buffer.writeUInt16BE(type, 2);
      buffer.writeUInt32BE(count, 4);
      buffer.writeUInt32BE(value, 8);
    }
    return buffer;
  };

  // 0x010e ImageDescription — a harmless tag, so the no-GPS case still has a
  // populated IFD rather than an empty one the parser might reject for free.
  entries.push(entry(0x010e, 2, 1, 0));
  if (gps) entries.push(entry(0x8825, 4, 1, 26));

  const count = Buffer.alloc(2);
  const next = Buffer.alloc(4);
  if (littleEndian) count.writeUInt16LE(entries.length, 0);
  else count.writeUInt16BE(entries.length, 0);

  const header = Buffer.alloc(8);
  header.write(littleEndian ? "II" : "MM", 0, "latin1");
  if (littleEndian) {
    header.writeUInt16LE(42, 2);
    header.writeUInt32LE(8, 4);
  } else {
    header.writeUInt16BE(42, 2);
    header.writeUInt32BE(8, 4);
  }

  return Buffer.concat([header, count, ...entries, next]);
}

function jpeg({ gps = false, littleEndian = true, exif = true } = {}) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (exif) {
    const payload = Buffer.concat([
      Buffer.from("Exif\0\0", "latin1"),
      tiffBlock({ gps, littleEndian }),
    ]);
    const length = Buffer.alloc(2);
    length.writeUInt16BE(payload.length + 2, 0);
    parts.push(Buffer.from([0xff, 0xe1]), length, payload);
  }
  // Start of scan, some pixel bytes, end of image.
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.alloc(8));
  parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function png({ gps = false } = {}) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [signature];
  if (gps) {
    const data = tiffBlock({ gps: true, littleEndian: true });
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    chunks.push(length, Buffer.from("eXIf", "latin1"), data, Buffer.alloc(4));
  }
  const end = Buffer.alloc(4);
  chunks.push(end, Buffer.from("IEND", "latin1"), Buffer.alloc(4));
  return Buffer.concat(chunks);
}

describe("image location metadata", () => {
  it("finds a GPS pointer in a little-endian JPEG", () => {
    expect(hasLocationMetadata(jpeg({ gps: true, littleEndian: true }))).toBe(
      true,
    );
  });

  it("finds a GPS pointer in a big-endian JPEG", () => {
    expect(hasLocationMetadata(jpeg({ gps: true, littleEndian: false }))).toBe(
      true,
    );
  });

  it("passes a JPEG whose EXIF carries no GPS", () => {
    expect(hasLocationMetadata(jpeg({ gps: false }))).toBe(false);
    expect(hasLocationMetadata(jpeg({ gps: false, littleEndian: false }))).toBe(
      false,
    );
  });

  it("passes a JPEG with no EXIF segment at all", () => {
    expect(hasLocationMetadata(jpeg({ exif: false }))).toBe(false);
  });

  it("finds a GPS pointer in a PNG eXIf chunk", () => {
    expect(hasLocationMetadata(png({ gps: true }))).toBe(true);
    expect(hasLocationMetadata(png({ gps: false }))).toBe(false);
  });

  it("returns false rather than throwing on input it cannot parse", () => {
    expect(hasLocationMetadata(Buffer.alloc(0))).toBe(false);
    expect(hasLocationMetadata(Buffer.from("not an image at all"))).toBe(false);
    expect(hasLocationMetadata(jpeg({ gps: true }).subarray(0, 14))).toBe(
      false,
    );
    expect(hasLocationMetadata(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false);
  });

  it("does not loop forever on a zero-length JPEG segment", () => {
    const broken = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00]),
      Buffer.alloc(16),
    ]);
    expect(hasLocationMetadata(broken)).toBe(false);
  });
});
