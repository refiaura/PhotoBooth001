/** Lama efek "jepret!" (kilat) ditampilkan setelah fireAt. */
export const SNAP_FLASH_MS = 800;

export type CountdownPhase =
  { kind: "get-ready" } | { kind: "count"; value: number } | { kind: "snap" } | { kind: "done" };

/** Tampilan hitung mundur dari sisa waktu (ms) menuju fireAt lokal. */
export function countdownPhase(remainingMs: number): CountdownPhase {
  if (remainingMs > 3000) return { kind: "get-ready" };
  if (remainingMs > 0) return { kind: "count", value: Math.ceil(remainingMs / 1000) };
  if (remainingMs >= -SNAP_FLASH_MS) return { kind: "snap" };
  return { kind: "done" };
}
