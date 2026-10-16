import "server-only";
import { generateBoothCode } from "@/domain/booth-code";
import type { Role } from "@/domain/session-machine";
import type { Database } from "./database.types";
import type { BoothPatch, BoothRow } from "./booth-snapshot";
import { ApiError } from "./http";
import { supabaseAdmin } from "./supabase-admin";
import { tokenHashBytea } from "./tokens";

export type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
export type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];

export const BUCKET = "booth-media";
const UNIQUE_VIOLATION = "23505";

const db = () => supabaseAdmin();

/** Booth terbaru dengan kode ini (kode unik di antara booth aktif, jadi yang terbaru = yang relevan). */
export async function findBoothByCode(code: string): Promise<BoothRow | null> {
  const { data, error } = await db()
    .from("booths")
    .select("*")
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBooth(id: string): Promise<BoothRow> {
  const { data, error } = await db().from("booths").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function hasGuest(boothId: string): Promise<boolean> {
  const { count, error } = await db()
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("booth_id", boothId)
    .eq("role", "guest");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Membuat booth + peserta host. Kode yang bentrok dengan booth aktif lain dicoba ulang. */
export async function createBoothWithHost(themeId: string, hostToken: string, userAgent: string | null) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: booth, error } = await db()
      .from("booths")
      .insert({ code: generateBoothCode(), theme_id: themeId })
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) continue;
    if (error) throw error;

    const participant = await insertParticipant(booth.id, "host", hostToken, userAgent);
    if (!participant) throw new Error("host gagal dibuat pada booth baru");
    return { booth, participant };
  }
  throw new Error("gagal mendapat kode booth unik");
}

/** null bila peran itu sudah terisi (booth penuh), dijamin UNIQUE(booth_id, role). */
export async function insertParticipant(
  boothId: string,
  role: Role,
  token: string,
  userAgent: string | null,
): Promise<ParticipantRow | null> {
  const { data, error } = await db()
    .from("participants")
    .insert({
      booth_id: boothId,
      role,
      token_hash: tokenHashBytea(token),
      user_agent: userAgent?.slice(0, 512),
    })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) return null;
  if (error) throw error;
  return data;
}

/** Peserta pemilik token di booth dengan kode ini; 401 bila tidak cocok. */
export async function authenticate(code: string, token: string | null) {
  if (!token) throw new ApiError(401, "UNAUTHORIZED");
  const { data, error } = await db()
    .from("participants")
    .select("*, booth:booths!inner(*)")
    .eq("token_hash", tokenHashBytea(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.booth.code !== code) throw new ApiError(401, "UNAUTHORIZED");
  const { booth, ...participant } = data;
  return { participant: participant as ParticipantRow, booth: booth as BoothRow };
}

/** Compare-and-swap: update hanya bila version belum berubah. null = konflik. */
export async function casUpdateBooth(
  id: string,
  version: number,
  patch: BoothPatch,
): Promise<BoothRow | null> {
  const { data, error } = await db()
    .from("booths")
    .update({ ...patch, version: version + 1 })
    .eq("id", id)
    .eq("version", version)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Klaim komposisi; hanya satu request yang menang. Klaim > 60 dtk dianggap macet dan boleh diambil alih. */
export async function claimCompose(boothId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await db()
    .from("booths")
    .update({ compose_started_at: new Date().toISOString() })
    .eq("id", boothId)
    .eq("status", "COMPOSING")
    .or(`compose_started_at.is.null,compose_started_at.lt.${staleBefore}`)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function releaseCompose(boothId: string): Promise<void> {
  const { error } = await db().from("booths").update({ compose_started_at: null }).eq("id", boothId);
  if (error) throw error;
}

export async function deleteParticipant(id: string): Promise<void> {
  const { error } = await db().from("participants").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Versi foto. Fase 1 belum punya retake, jadi selalu 1.
 * Fase 2 (retake) menaikkan versi per shot yang diulang.
 */
export const PHOTO_VERSION = 1;

/** Membuat (atau mengambil) baris foto untuk satu jepretan. Idempoten. */
export async function upsertPhoto(params: {
  boothId: string;
  participantId: string;
  shotIndex: number;
  storageKey: string;
}): Promise<PhotoRow> {
  const { boothId, participantId, shotIndex, storageKey } = params;
  const existing = await db()
    .from("photos")
    .select("*")
    .eq("participant_id", participantId)
    .eq("shot_index", shotIndex)
    .eq("version", PHOTO_VERSION)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const { data, error } = await db()
    .from("photos")
    .insert({
      booth_id: boothId,
      participant_id: participantId,
      shot_index: shotIndex,
      version: PHOTO_VERSION,
      storage_key: storageKey,
    })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) return upsertPhoto(params);
  if (error) throw error;
  return data;
}

export async function getPhotoOf(participantId: string, photoId: string): Promise<PhotoRow | null> {
  const { data, error } = await db()
    .from("photos")
    .select("*")
    .eq("id", photoId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markPhotoUploaded(
  photoId: string,
  meta: { mimeType: "image/webp" | "image/jpeg"; width: number; height: number; sizeBytes: number },
) {
  const { error } = await db()
    .from("photos")
    .update({
      mime_type: meta.mimeType,
      width: meta.width,
      height: meta.height,
      size_bytes: meta.sizeBytes,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", photoId);
  if (error) throw error;
}

/** Foto versi terbaru yang sudah terunggah, lengkap dengan peran pemiliknya. */
export async function latestUploadedPhotos(boothId: string) {
  const { data, error } = await db()
    .from("photos")
    .select("shot_index, version, storage_key, participant:participants!inner(role)")
    .eq("booth_id", boothId)
    .not("uploaded_at", "is", null)
    .order("version", { ascending: false });
  if (error) throw error;

  const latest = new Map<string, { role: Role; shotIndex: number; storageKey: string }>();
  for (const p of data) {
    const key = `${p.participant.role}:${p.shot_index}`;
    if (!latest.has(key)) {
      latest.set(key, { role: p.participant.role, shotIndex: p.shot_index, storageKey: p.storage_key });
    }
  }
  return [...latest.values()];
}

export async function insertStrip(params: { boothId: string; slug: string; storageKey: string }) {
  const { error } = await db().from("strips").insert({
    booth_id: params.boothId,
    format: "strip",
    public_slug: params.slug,
    storage_key: params.storageKey,
  });
  if (error) throw error;
}

export async function findStripsBySlug(slug: string) {
  const { data, error } = await db()
    .from("strips")
    .select("format, storage_key, created_at, expires_at")
    .eq("public_slug", slug)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return data;
}

export const storage = () => db().storage.from(BUCKET);
