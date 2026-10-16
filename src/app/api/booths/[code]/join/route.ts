import { z } from "zod";
import { boothCodeFrom, sessionBody } from "@/server/booth-api";
import { authenticate, findBoothByCode, insertParticipant } from "@/server/booth-repo";
import { ApiError, clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { applyEvent, reconcileBooth } from "@/server/session-service";
import { generateToken } from "@/server/tokens";

const body = z.object({ token: z.string().min(1).max(200).optional() });

/**
 * Tamu masuk lewat link undangan, tanpa akun.
 * Dengan token lama (tersimpan di perangkat), ini menjadi rejoin: refresh bukan peserta baru.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/join">) => {
  await enforceRateLimit("join", clientIp(request));
  const code = await boothCodeFrom(ctx.params);
  const { token: existingToken } = await readJson(request, body);

  if (existingToken) {
    try {
      const { participant, booth } = await authenticate(code, existingToken);
      return json({ token: existingToken, ...(await sessionBody(booth, participant.role)) });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // Token tidak cocok dengan booth ini: lanjut sebagai tamu baru.
    }
  }

  const found = await findBoothByCode(code);
  if (!found) throw new ApiError(404, "NOT_FOUND");
  const booth = await reconcileBooth(found);
  if (booth.status === "EXPIRED" || booth.status === "DONE") throw new ApiError(410, "GONE");

  const token = generateToken();
  const guest = await insertParticipant(booth.id, "guest", token, request.headers.get("user-agent"));
  if (!guest) throw new ApiError(409, "FULL");
  console.info("[event] tamu_masuk");

  const { booth: joined } = await applyEvent(booth, { type: "GUEST_JOINED" });
  return json({ token, ...(await sessionBody(joined, "guest", true)) }, 201);
});
