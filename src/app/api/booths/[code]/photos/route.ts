import { z } from "zod";
import { authorizedBooth, sessionBody } from "@/server/booth-api";
import { getBooth, getPhotoOf, markPhotoUploaded, storage } from "@/server/booth-repo";
import { ApiError, handler, json, readJson } from "@/server/http";
import { validatePhoto } from "@/server/photo-validation";
import { applyEvent } from "@/server/session-service";

const body = z.object({ photoId: z.uuid() });

/**
 * Konfirmasi unggahan selesai. File divalidasi dari isinya (tipe, ukuran, dimensi);
 * file yang tidak lolos dihapus. Unggahan terakhir memicu komposisi photostrip.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/booths/[code]/photos">) => {
  const { participant, booth } = await authorizedBooth(request, ctx.params);
  const { photoId } = await readJson(request, body);

  const photo = await getPhotoOf(participant.id, photoId);
  if (!photo || photo.booth_id !== booth.id) throw new ApiError(404, "NOT_FOUND");

  // File yang sudah lolos validasi tidak divalidasi ulang. Event tetap dikirim (idempoten),
  // karena percobaan sebelumnya bisa gagal SETELAH file ditandai tapi SEBELUM state tersimpan.
  if (!photo.uploaded_at) {
    const { data, error } = await storage().download(photo.storage_key);
    if (error) throw new ApiError(409, "NOT_UPLOADED");
    const validation = await validatePhoto(Buffer.from(await data.arrayBuffer()));
    if (!validation.ok) {
      await storage().remove([photo.storage_key]);
      throw new ApiError(422, validation.reason);
    }
    await markPhotoUploaded(photo.id, validation.meta);
  }

  try {
    const result = await applyEvent(booth, {
      type: "PHOTO_UPLOADED",
      role: participant.role,
      shotIndex: photo.shot_index,
    });
    return json(await sessionBody(result.booth, participant.role, result.hasGuest));
  } catch (err) {
    // Retry yang terlambat (sesi sudah REVIEW/DONE): unggahan memang sudah tercatat.
    if (err instanceof ApiError && err.code === "INVALID_STATE") {
      return json(await sessionBody(await getBooth(booth.id), participant.role));
    }
    throw err;
  }
});
