import { boothCodeFrom } from "@/server/booth-api";
import { findBoothByCode, hasGuest } from "@/server/booth-repo";
import { ApiError, clientIp, handler, json } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { reconcileBooth } from "@/server/session-service";

/** Info publik booth: cukup untuk menampilkan halaman ramah (penuh / kedaluwarsa / bisa masuk). */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]">) => {
  await enforceRateLimit("boothInfo", clientIp(request));
  const code = await boothCodeFrom(ctx.params);
  const found = await findBoothByCode(code);
  if (!found) throw new ApiError(404, "NOT_FOUND");

  const booth = await reconcileBooth(found);
  return json({
    code: booth.code,
    status: booth.status,
    full: await hasGuest(booth.id),
    themeId: booth.theme_id,
    expiresAt: Date.parse(booth.expires_at),
  });
});
