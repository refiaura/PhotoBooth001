export type CameraError = "unsupported" | "denied" | "not-found" | "busy" | "unknown";

export const isCameraSupported = () =>
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * Menyalakan kamera depan. Dipanggil HANYA setelah pengguna menekan tombol (PRD),
 * agar prompt izin tidak muncul tiba-tiba. Minimal 1280×720, idealnya 1920×1080.
 */
export async function startCamera(): Promise<MediaStream> {
  if (!isCameraSupported()) throw cameraError("unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
      },
    });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === "NotAllowedError" || name === "SecurityError") throw cameraError("denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw cameraError("not-found");
    if (name === "NotReadableError" || name === "AbortError") throw cameraError("busy");
    throw cameraError("unknown");
  }
}

/** Mematikan semua track agar indikator kamera tidak terus menyala. */
export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraError(kind: CameraError) {
  return Object.assign(new Error(`camera:${kind}`), { kind });
}

export const cameraErrorKind = (err: unknown): CameraError =>
  (err as { kind?: CameraError }).kind ?? "unknown";
