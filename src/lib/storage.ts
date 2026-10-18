export const ORIGINALS_BUCKET = "report-originals";
export const PUBLIC_BUCKET = "report-public";
export const PROOFS_BUCKET = "digest-proofs";

/** Public URL of a cleared photo in the report-public bucket. */
export function publicPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 3;
