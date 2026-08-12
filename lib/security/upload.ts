const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47,
  "image/webp": (bytes) =>
    ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP",
  "audio/mpeg": (bytes) =>
    ascii(bytes, 0, 3) === "ID3" ||
    (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0),
  "audio/wav": (bytes) =>
    ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE",
  "audio/mp4": (bytes) => ascii(bytes, 4, 4) === "ftyp",
  "audio/webm": (bytes) =>
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3,
  "video/mp4": (bytes) => ascii(bytes, 4, 4) === "ftyp",
  "application/pdf": (bytes) => ascii(bytes, 0, 5) === "%PDF-",
};

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

export async function hasAllowedFileSignature(file: File, mimeType: string) {
  const signature = signatures[mimeType];
  if (!signature) return false;
  return signature(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}
