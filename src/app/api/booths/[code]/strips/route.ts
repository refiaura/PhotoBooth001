import { allUploaded } from "@/domain/session-machine";
import { authorizedBooth, sessionBody } from "@/server/booth-api";
import { getBooth, hasGuest } from "@/server/booth-repo";
import { rowToSnapshot } from "@/server/booth-snapshot";
import { handler, json } from "@/server/http";
import { composeStrip } from "@/server/session-service";

/**
 * Memulai komposisi. Biasanya dipicu otomatis oleh unggahan terakhir; endpoint ini
 * dipakai klien untuk memulihkan komposisi yang macet. Idempoten.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/strips">) => {
  const { participant, booth } = await authorizedBooth(request, ctx.params);
  const guest = await hasGuest(booth.id);
  if (booth.status === "COMPOSING" && allUploaded(rowToSnapshot(booth, guest))) {
    await composeStrip(booth.id);
  }
  return json(await sessionBody(await getBooth(booth.id), participant.role, guest));
});
