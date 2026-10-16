import "server-only";
import { safeEqual } from "./tokens";

/** Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCron(authHeader: string | null, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  return safeEqual(authHeader.slice("Bearer ".length), secret);
}
