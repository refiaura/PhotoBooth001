import { PING_COUNT, estimateOffset, type PingSample } from "@/domain/clock-sync";
import { api } from "./api";

/** Kalibrasi selisih jam: PING_COUNT ping berurutan ke /api/time, median offset. */
export async function calibrateClock(): Promise<number> {
  const samples: PingSample[] = [];
  for (let i = 0; i < PING_COUNT; i++) {
    const t0 = Date.now();
    const { now } = await api.serverTime();
    samples.push({ t0, serverTime: now, t1: Date.now() });
  }
  return estimateOffset(samples);
}
