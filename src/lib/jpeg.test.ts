import { describe, expect, it } from "vitest";
import { stripJpegMetadata } from "./jpeg";

const segment = (marker: number, payload: number[]) => [0xff, marker, 0x00, payload.length + 2, ...payload];

function jpeg(...segments: number[][]) {
  const scan = [0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), ...scan]);
}

describe("stripJpegMetadata", () => {
  it("drops EXIF, XMP and comments but keeps JFIF, tables and image data", () => {
    const jfif = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]);
    const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53]);
    const comment = segment(0xfe, [0x68, 0x69]);
    const quant = segment(0xdb, [0x00, 0x01, 0x02]);

    const stripped = stripJpegMetadata(jpeg(jfif, exif, comment, quant))!;
    expect(Array.from(stripped)).toEqual(Array.from(jpeg(jfif, quant)));
  });

  it("rejects data that is not a JPEG", () => {
    expect(stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it("rejects truncated segments", () => {
    expect(stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40, 0x01]))).toBeNull();
  });
});
