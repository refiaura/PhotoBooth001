export type CapturedPhoto = {
  blob: Blob;
  mimeType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
};

const QUALITY = 0.85;
const TARGET_BYTES = 500 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Mengambil satu frame resolusi penuh dari kamera LOKAL (bukan dari stream WebRTC).
 * Foto akhir TIDAK di-mirror (mirror hanya untuk preview). Encode ulang lewat canvas
 * otomatis membuang metadata EXIF termasuk lokasi.
 *
 * Catatan: ImageCapture.takePhoto() sengaja tidak dipakai karena latensinya tidak
 * menentu (ratusan ms, kadang me-reset stream di Android) dan merusak target sinkron ≤ 300 ms.
 */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("kamera belum siap");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(video, 0, 0, width, height);
  return canvas;
}

/** WebP kualitas 0,85; fallback JPEG (Safari lama). Turunkan kualitas bila > 500 KB. */
export async function encodeFrame(canvas: HTMLCanvasElement): Promise<CapturedPhoto> {
  for (const type of ["image/webp", "image/jpeg"] as const) {
    let quality = QUALITY;
    let blob = await toBlob(canvas, type, quality);
    // Browser tanpa encoder WebP diam-diam mengembalikan PNG: abaikan dan coba JPEG.
    if (!blob || blob.type !== type) continue;
    while (blob.size > TARGET_BYTES && quality > 0.5) {
      quality -= 0.1;
      blob = (await toBlob(canvas, type, quality)) ?? blob;
    }
    return { blob, mimeType: type, width: canvas.width, height: canvas.height };
  }
  throw new Error("browser tidak bisa meng-encode foto");
}
