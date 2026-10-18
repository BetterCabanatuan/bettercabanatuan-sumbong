/**
 * Removes metadata segments (EXIF/GPS in APP1, XMP, ICC and other APPn, comments) from a
 * JPEG, keeping only what is needed to decode it. Returns null if the bytes are not a JPEG.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;

  const kept: Uint8Array[] = [input.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) return null;
    const marker = input[offset + 1];

    // Fill bytes between segments.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    // Start of scan: everything from here on is entropy-coded image data.
    if (marker === 0xda) {
      kept.push(input.subarray(offset));
      return concat(kept);
    }

    // Standalone markers without a length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(input.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const length = (input[offset + 2] << 8) | input[offset + 3];
    if (length < 2 || offset + 2 + length > input.length) return null;

    const isApp0 = marker === 0xe0;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (isApp0 || !isMetadata) kept.push(input.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }

  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
