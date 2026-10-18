/**
 * Re-encodes an image as a JPEG of at most `maxSize` px on its longest side. Drawing to a
 * canvas drops all metadata (EXIF, GPS), applies the camera orientation, and shrinks
 * phone photos to something that uploads on mobile data.
 */
export async function toUploadableJpeg(file: File | Blob, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvasToJpeg(canvas, quality);
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode JPEG"))), "image/jpeg", quality),
  );
}
