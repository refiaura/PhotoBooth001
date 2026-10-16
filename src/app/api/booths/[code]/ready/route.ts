import { z } from "zod";
import { authorizedBooth, sessionBody } from "@/server/booth-api";
import { handler, json, readJson } from "@/server/http";
import { applyEvent } from "@/server/session-service";

const body = z.object({ ready: z.boolean() });

/** Tombol "Siap!". Saat keduanya siap, server menjadwalkan jepretan pertama. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/ready">) => {
  const { participant, booth } = await authorizedBooth(request, ctx.params);
  const { ready } = await readJson(request, body);
  const result = await applyEvent(booth, { type: "SET_READY", role: participant.role, ready });
  if (result.booth.status === "CAPTURING" && booth.status !== "CAPTURING") console.info("[event] sesi_mulai");
  return json(await sessionBody(result.booth, participant.role, result.hasGuest));
});
