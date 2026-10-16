import "server-only";
import { reconcile, transition, type SessionEffect, type SessionEvent } from "@/domain/session-machine";
import { getTheme } from "@/domain/themes";
import { broadcast } from "./broadcast";
import {
  casUpdateBooth,
  claimCompose,
  getBooth,
  hasGuest as loadHasGuest,
  insertStrip,
  latestUploadedPhotos,
  releaseCompose,
  storage,
} from "./booth-repo";
import {
  rowToSnapshot,
  snapshotToPatch,
  toPublicSession,
  type BoothPatch,
  type BoothRow,
} from "./booth-snapshot";
import { renderStrip } from "./compose/render-strip";
import { ApiError } from "./http";
import { generateSlug } from "./tokens";

const MAX_CAS_ATTEMPTS = 8;

const ERROR_STATUS = { INVALID_STATE: 409, WRONG_SHOT: 409, NOT_CAPTURED: 409, PHOTOS_INCOMPLETE: 409 };

async function publishState(booth: BoothRow, hasGuest: boolean) {
  await broadcast(booth.id, "session:state", toPublicSession(booth, hasGuest, Date.now()));
}

/**
 * Menerapkan batas waktu lazy (kedaluwarsa 24 jam, PAUSED > 2 menit).
 * Dipanggil sebelum setiap event dan saat klien memuat snapshot.
 */
export async function reconcileBooth(booth: BoothRow): Promise<BoothRow> {
  let current = booth;
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const guest = await loadHasGuest(current.id);
    const result = reconcile(rowToSnapshot(current, guest), Date.now());
    if (!result) return current;
    const saved = await casUpdateBooth(current.id, current.version, snapshotToPatch(result.next));
    if (saved) {
      await publishState(saved, guest);
      return saved;
    }
    current = await getBooth(current.id);
  }
  throw new ApiError(503, "BUSY");
}

/**
 * Inti server-authoritative: muat → transition() murni → simpan dengan compare-and-swap
 * → siarkan → jalankan efek. Konflik versi (request bersamaan) dicoba ulang dari data terbaru,
 * sehingga dua peserta yang menjepret bersamaan tetap memajukan sesi tepat sekali.
 */
export async function applyEvent(
  booth: BoothRow,
  event: SessionEvent,
  extraPatch: BoothPatch = {},
): Promise<{ booth: BoothRow; hasGuest: boolean }> {
  let current = await reconcileBooth(booth);

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const guest = await loadHasGuest(current.id);
    const result = transition(rowToSnapshot(current, guest), event, Date.now());
    if (!result.ok) throw new ApiError(ERROR_STATUS[result.error], result.error);

    // Versi tetap dinaikkan walau snapshot tidak berubah: request bersamaan yang membaca
    // data lama dipaksa konflik dan mengevaluasi ulang dengan data terbaru.
    const saved = await casUpdateBooth(current.id, current.version, {
      ...snapshotToPatch(result.next),
      ...extraPatch,
    });
    if (!saved) {
      current = await getBooth(current.id);
      continue;
    }

    await publishState(saved, guest);
    await runEffects(saved, result.effects);
    return { booth: result.effects.length > 0 ? await getBooth(saved.id) : saved, hasGuest: guest };
  }
  throw new ApiError(503, "BUSY");
}

async function runEffects(booth: BoothRow, effects: SessionEffect[]) {
  for (const effect of effects) {
    if (effect.type === "SHOT_SCHEDULED") {
      await broadcast(booth.id, "shot:scheduled", { shotIndex: effect.shotIndex, fireAt: effect.fireAt });
    } else {
      // State sudah tersimpan; kegagalan komposisi tidak boleh menggagalkan request pemicu.
      // Klien mencoba ulang lewat POST /strips secara berkala selama masih COMPOSING.
      await composeStrip(booth.id).catch((err) => console.error("[compose] gagal", err));
    }
  }
}

/**
 * Menyusun photostrip bila booth COMPOSING dan semua foto terunggah.
 * Aman dipanggil berulang: hanya satu pemanggil yang memenangkan klaim.
 */
export async function composeStrip(boothId: string): Promise<void> {
  if (!(await claimCompose(boothId))) return;
  try {
    await composeClaimed(boothId);
  } catch (err) {
    // Lepas klaim agar percobaan berikutnya tidak perlu menunggu klaim dianggap basi.
    await releaseCompose(boothId);
    throw err;
  }
}

async function composeClaimed(boothId: string) {
  const booth = await getBooth(boothId);
  const photos = await latestUploadedPhotos(boothId);
  const buffers = await Promise.all(
    photos.map(async (p) => {
      const { data, error } = await storage().download(p.storageKey);
      if (error) throw error;
      return { role: p.role, shotIndex: p.shotIndex, buffer: Buffer.from(await data.arrayBuffer()) };
    }),
  );

  const png = await renderStrip(getTheme(booth.theme_id), buffers);
  const slug = generateSlug();
  const storageKey = `booths/${boothId}/strips/${slug}-strip.png`;
  const { error } = await storage().upload(storageKey, png, { contentType: "image/png", upsert: false });
  if (error) throw error;
  await insertStrip({ boothId, slug, storageKey });

  const { booth: done } = await applyEvent(
    booth,
    { type: "COMPOSE_DONE" },
    // Klaim dikosongkan agar retake (Fase 2) bisa menyusun ulang.
    { strip_slug: slug, compose_started_at: null },
  );
  await broadcast(boothId, "strip:ready", { stripSlug: done.strip_slug });
}
