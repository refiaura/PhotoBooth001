import { z } from "zod";
import { DEFAULT_THEME_ID } from "@/domain/themes";
import { createBoothWithHost } from "@/server/booth-repo";
import { serverEnv } from "@/server/env";
import { ApiError, clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { generateToken, safeEqual } from "@/server/tokens";

const body = z.object({ accessCode: z.string().min(1).max(200) });

/** Buat booth. Hanya pemegang ACCESS_CODE; mengembalikan kode, link undangan, dan token host. */
export const POST = handler(async (request: Request) => {
  await enforceRateLimit("createBooth", clientIp(request));
  const { accessCode } = await readJson(request, body);
  if (!safeEqual(accessCode, serverEnv().ACCESS_CODE)) throw new ApiError(403, "WRONG_ACCESS_CODE");

  const token = generateToken();
  const { booth } = await createBoothWithHost(DEFAULT_THEME_ID, token, request.headers.get("user-agent"));
  console.info("[event] booth_dibuat");

  return json(
    {
      code: booth.code,
      token,
      inviteUrl: new URL(`/b/${booth.code}`, request.url).toString(),
      expiresAt: Date.parse(booth.expires_at),
    },
    201,
  );
});
