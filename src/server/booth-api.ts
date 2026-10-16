import "server-only";
import { isValidBoothCode, normalizeBoothCode } from "@/domain/booth-code";
import type { Role } from "@/domain/session-machine";
import { authenticate, hasGuest } from "./booth-repo";
import { toPublicSession, type BoothRow, type PublicSession } from "./booth-snapshot";
import { ApiError, bearerToken } from "./http";
import { reconcileBooth } from "./session-service";

/** Kode booth dari parameter URL; 404 bila formatnya mustahil valid. */
export async function boothCodeFrom(params: Promise<{ code: string }>): Promise<string> {
  const code = normalizeBoothCode((await params).code);
  if (!isValidBoothCode(code)) throw new ApiError(404, "NOT_FOUND");
  return code;
}

/** Peserta terautentikasi + booth yang sudah di-reconcile. */
export async function authorizedBooth(request: Request, params: Promise<{ code: string }>) {
  const code = await boothCodeFrom(params);
  const { participant, booth } = await authenticate(code, bearerToken(request));
  return { participant, booth: await reconcileBooth(booth) };
}

export type SessionBody = { role: Role; session: PublicSession };

export async function sessionBody(booth: BoothRow, role: Role, guest?: boolean): Promise<SessionBody> {
  return { role, session: toPublicSession(booth, guest ?? (await hasGuest(booth.id)), Date.now()) };
}
