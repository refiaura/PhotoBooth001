import { authorizedBooth, sessionBody } from "@/server/booth-api";
import { handler, json } from "@/server/http";

/**
 * Snapshot sesi saja, untuk polling cadangan dan sinkron ulang. Sengaja tanpa token
 * Realtime dan kredensial TURN, agar polling tiap detik tidak memanggil Cloudflare.
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/state">) => {
  const { participant, booth } = await authorizedBooth(request, ctx.params);
  return json(await sessionBody(booth, participant.role));
});
