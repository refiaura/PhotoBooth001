import { randomBytes } from "node:crypto";
import { z } from "zod";
import { SHOTS_PER_PERSON } from "@/domain/session-machine";
import { authorizedBooth } from "@/server/booth-api";
import { PHOTO_VERSION, storage, upsertPhoto } from "@/server/booth-repo";
import { handler, json, readJson } from "@/server/http";
import { applyEvent } from "@/server/session-service";

const body = z.object({
  shotIndex: z
    .number()
    .int()
    .min(0)
    .max(SHOTS_PER_PERSON - 1),
  mimeType: z.enum(["image/webp", "image/jpeg"]),
});

const EXT = { "image/webp": "webp", "image/jpeg": "jpg" } as const;

/**
 * Dipanggil tepat setelah foto diambil di perangkat (gabungan `shot:captured` + permintaan
 * signed upload URL). Server mencatat jepretan, dan bila pasangannya juga sudah,
 * menjadwalkan jepretan berikutnya. Idempoten untuk retry.
 */
export const POST = handler(
  async (request: Request, ctx: RouteContext<"/api/booths/[code]/photos/upload-url">) => {
    const { participant, booth } = await authorizedBooth(request, ctx.params);
    const { shotIndex, mimeType } = await readJson(request, body);

    await applyEvent(booth, { type: "SHOT_CAPTURED", role: participant.role, shotIndex });

    const photo = await upsertPhoto({
      boothId: booth.id,
      participantId: participant.id,
      shotIndex,
      storageKey:
        `booths/${booth.id}/photos/${participant.id}/` +
        `${shotIndex}-v${PHOTO_VERSION}-${randomBytes(6).toString("hex")}.${EXT[mimeType]}`,
    });

    const { data, error } = await storage().createSignedUploadUrl(photo.storage_key);
    if (error) throw error;
    return json({ photoId: photo.id, path: data.path, token: data.token });
  },
);
