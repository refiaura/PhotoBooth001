import { withRetry } from "@/lib/retry";
import { api, ApiClientError } from "./api";
import type { CapturedPhoto } from "./capture";
import { supabaseBrowser } from "./supabase-browser";

const BUCKET = "booth-media";

const retryable = (err: unknown) => !(err instanceof ApiClientError) || err.retryable;

/**
 * Pipeline satu foto: tandai "sudah dijepret" (sekaligus minta signed URL) → unggah langsung
 * ke Storage → konfirmasi. Tiap langkah dicoba ulang 3x (1, 2, 4 detik). Blob tetap di
 * memori selama proses agar tidak hilang saat retry.
 *
 * `onCaptured` dipanggil segera setelah server mencatat jepretan, sebelum unggahan selesai,
 * karena jadwal jepretan berikutnya hanya bergantung pada langkah pertama.
 */
export async function submitPhoto(params: {
  code: string;
  token: string;
  shotIndex: number;
  photo: CapturedPhoto;
  onCaptured?: () => void;
  onRetry?: () => void;
}) {
  const { code, token, shotIndex, photo, onCaptured, onRetry } = params;
  const opts = { shouldRetry: retryable, onRetry };

  const target = await withRetry(() => api.shotCaptured(code, token, shotIndex, photo.mimeType), opts);
  onCaptured?.();

  await withRetry(
    async () => {
      const { error } = await supabaseBrowser()
        .storage.from(BUCKET)
        .uploadToSignedUrl(target.path, target.token, photo.blob, { contentType: photo.mimeType });
      // Unggahan sebelumnya ternyata sudah masuk (respons hilang di jalan): anggap berhasil.
      if (error && !/exist|duplicate/i.test(error.message)) throw error;
    },
    { onRetry },
  );

  return withRetry(() => api.confirmPhoto(code, token, target.photoId), opts);
}
