import type { BoothStatus, ShotSlot } from "./session-machine";

/** Status di mana foto yang belum terunggah masih ditunggu server. */
const AWAITING_UPLOADS: ReadonlySet<BoothStatus> = new Set(["CAPTURING", "COMPOSING"]);

/**
 * Shot milik peserta ini yang sudah tercatat "dijepret" di server tetapi belum terunggah,
 * dan fotonya tidak ada di perangkat (mis. halaman di-reload di tengah unggahan).
 * Tanpa pemulihan, sesi akan menunggu foto itu selamanya di COMPOSING.
 */
export function orphanedShots(
  status: BoothStatus,
  slots: readonly ShotSlot[],
  pendingOnDevice: ReadonlySet<number>,
): number[] {
  if (!AWAITING_UPLOADS.has(status)) return [];
  return slots.flatMap((slot, i) => (slot.captured && !slot.uploaded && !pendingOnDevice.has(i) ? [i] : []));
}
