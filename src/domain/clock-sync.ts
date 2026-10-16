/**
 * Kalibrasi selisih jam klien ↔ server (PRD: "Sinkronisasi hitung mundur").
 * Klien melakukan PING_COUNT kali ping ke /api/time, lalu memakai median offset.
 */

export const PING_COUNT = 5;

export type PingSample = {
  /** Jam lokal saat request dikirim (ms). */
  t0: number;
  /** Jam server dari respons (ms). */
  serverTime: number;
  /** Jam lokal saat respons diterima (ms). */
  t1: number;
};

/** offset = serverTime - (t0 + t1) / 2, dengan asumsi latensi pergi = pulang. */
export const offsetFromSample = ({ t0, serverTime, t1 }: PingSample) => serverTime - (t0 + t1) / 2;

export function estimateOffset(samples: readonly PingSample[]): number {
  if (samples.length === 0) throw new Error("estimateOffset: butuh minimal satu sampel");
  const offsets = samples.map(offsetFromSample).sort((a, b) => a - b);
  const mid = Math.floor(offsets.length / 2);
  return offsets.length % 2 === 1 ? offsets[mid] : (offsets[mid - 1] + offsets[mid]) / 2;
}

/** Mengubah timestamp server (mis. fireAt) menjadi jam lokal perangkat ini. */
export const serverToLocal = (serverTime: number, offset: number) => serverTime - offset;
