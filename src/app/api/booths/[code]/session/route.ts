import { authorizedBooth, sessionBody } from "@/server/booth-api";
import { handler, json } from "@/server/http";
import { boothChannel, createRealtimeToken } from "@/server/realtime-token";
import { iceServers } from "@/server/turn";

/** Snapshot sesi + semua yang dibutuhkan klien untuk tersambung (Realtime + WebRTC). */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/session">) => {
  const { participant, booth } = await authorizedBooth(request, ctx.params);
  const [body, realtimeToken, ice] = await Promise.all([
    sessionBody(booth, participant.role),
    createRealtimeToken(booth.id, participant.id),
    iceServers(),
  ]);
  return json({
    ...body,
    realtime: { channel: boothChannel(booth.id), token: realtimeToken },
    iceServers: ice,
  });
});
