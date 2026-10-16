import "server-only";
import { ApiError } from "./http";
import { supabaseAdmin } from "./supabase-admin";

export const RATE_LIMITS = {
  /** Pembuatan booth (menebak kode akses). */
  createBooth: { windowSeconds: 600, max: 10 },
  /** Join booth: 10 percobaan/menit per IP (PRD). */
  join: { windowSeconds: 60, max: 10 },
  /** Info publik booth (menebak kode). */
  boothInfo: { windowSeconds: 60, max: 30 },
} as const;

export async function enforceRateLimit(name: keyof typeof RATE_LIMITS, ip: string): Promise<void> {
  const { windowSeconds, max } = RATE_LIMITS[name];
  const { data, error } = await supabaseAdmin().rpc("hit_rate_limit", {
    p_key: `${name}:${ip}`,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw error;
  if (data === false) throw new ApiError(429, "RATE_LIMITED");
}
