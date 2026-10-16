import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>`.
 * Perbandingan dilakukan atas hash agar panjang input tidak bocor lewat waktu eksekusi.
 */
export function isAuthorizedCron(authHeader: string | null, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  return timingSafeEqual(sha256(provided), sha256(secret));
}
