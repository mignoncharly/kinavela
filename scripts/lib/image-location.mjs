/**
 * Detects whether an image still carries embedded location metadata.
 *
 * A photograph taken in someone's kitchen and committed straight from a phone
 * carries the coordinates of that kitchen. On a site whose whole promise is
 * that precise locations are never published, that is the single most likely
 * way to break it — and it is invisible in review, because the picture looks
 * exactly the same either way.
 *
 * Written by hand rather than pulled from a package: this reads a handful of
 * bytes from files we control, and a dependency that parses untrusted image
 * metadata would be a larger surface than the problem it solves.
 */

const JPEG_SOI = 0xffd8;
const EXIF_GPS_IFD_TAG = 0x8825;

/** Reads a 16- or 32-bit integer in the endianness the TIFF header declared. */
function readInt(buffer, offset, size, littleEndian) {
  if (offset + size > buffer.length) return null;
  return littleEndian
    ? size === 2
      ? buffer.readUInt16LE(offset)
      : buffer.readUInt32LE(offset)
    : size === 2
      ? buffer.readUInt16BE(offset)
      : buffer.readUInt32BE(offset);
}

/** True when the TIFF block starting at `start` has a GPS IFD pointer. */
function tiffHasGps(buffer, start) {
  const byteOrder = readInt(buffer, start, 2, false);
  // 0x4949 = "II" little-endian, 0x4d4d = "MM" big-endian.
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return false;
  const littleEndian = byteOrder === 0x4949;

  if (readInt(buffer, start + 2, 2, littleEndian) !== 42) return false;

  const ifdOffset = readInt(buffer, start + 4, 4, littleEndian);
  if (ifdOffset === null) return false;

  const ifdStart = start + ifdOffset;
  const entryCount = readInt(buffer, ifdStart, 2, littleEndian);
  if (entryCount === null || entryCount > 512) return false;

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (readInt(buffer, entry, 2, littleEndian) === EXIF_GPS_IFD_TAG) {
      return true;
    }
  }
  return false;
}

function jpegHasGps(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer.readUInt16BE(offset);
    // Start of scan: pixel data begins, no more metadata segments follow.
    if (marker === 0xffda) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;

    if (marker === 0xffe1) {
      const header = buffer
        .subarray(offset + 4, offset + 10)
        .toString("latin1");
      if (header === "Exif\0\0" && tiffHasGps(buffer, offset + 10)) return true;
    }
    offset += 2 + length;
  }
  return false;
}

function pngHasGps(buffer) {
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("latin1");
    if (type === "IEND") break;
    if (type === "eXIf" && tiffHasGps(buffer, offset + 8)) return true;
    offset += 12 + length;
  }
  return false;
}

/** @param {Buffer} buffer raw image bytes */
export function hasLocationMetadata(buffer) {
  if (buffer.length < 12) return false;
  if (buffer.readUInt16BE(0) === JPEG_SOI) return jpegHasGps(buffer);
  if (buffer.readUInt32BE(0) === 0x89504e47) return pngHasGps(buffer);
  return false;
}
