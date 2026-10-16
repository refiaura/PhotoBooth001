import sharp from "sharp";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 320;
const MAX_SIDE = 8000;

export type PhotoMime = "image/webp" | "image/jpeg";
export type PhotoMeta = { mimeType: PhotoMime; width: number; height: number; sizeBytes: number };
export type PhotoValidation =
  | { ok: true; meta: PhotoMeta }
  | { ok: false; reason: "TOO_LARGE" | "BAD_TYPE" | "BAD_DIMENSIONS" | "CORRUPT" };

/** Tipe file dari magic bytes (PRD: validasi isi file, bukan ekstensi). */
export function sniffImageType(buf: Buffer): PhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function validatePhoto(buf: Buffer): Promise<PhotoValidation> {
  if (buf.length > MAX_PHOTO_BYTES) return { ok: false, reason: "TOO_LARGE" };
  const mimeType = sniffImageType(buf);
  if (!mimeType) return { ok: false, reason: "BAD_TYPE" };

  let width: number | undefined;
  let height: number | undefined;
  try {
    // stats() memaksa decode penuh, sehingga file dengan header valid tapi isi rusak ditolak.
    const image = sharp(buf, { failOn: "error" });
    ({ width, height } = await image.metadata());
    await image.stats();
  } catch {
    return { ok: false, reason: "CORRUPT" };
  }

  const sides = [width ?? 0, height ?? 0];
  if (sides.some((side) => side < MIN_SIDE || side > MAX_SIDE))
    return { ok: false, reason: "BAD_DIMENSIONS" };
  return { ok: true, meta: { mimeType, width: width!, height: height!, sizeBytes: buf.length } };
}
