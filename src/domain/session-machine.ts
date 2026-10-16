/**
 * State machine sesi foto (PRD: "Status Sesi (State Machine)").
 *
 * Fungsi murni: tidak ada I/O, waktu dikirim sebagai argumen. API route memuat
 * snapshot dari Postgres, memanggil `transition`, menyimpan `next`, lalu menjalankan `effects`.
 */

export const SHOTS_PER_PERSON = 4;
/** Jarak jadwal jepret dari "sekarang" (jam server). */
export const SHOT_LEAD_MS = 3500;
/** Lama menunggu peserta yang terputus sebelum sesi berakhir (keputusan K3). */
export const PAUSE_TIMEOUT_MS = 2 * 60 * 1000;

export type BoothStatus =
  "WAITING_GUEST" | "WAITING_READY" | "CAPTURING" | "COMPOSING" | "REVIEW" | "DONE" | "PAUSED" | "EXPIRED";

export type Role = "host" | "guest";
export const ROLES: readonly Role[] = ["host", "guest"];

/** Status yang boleh di-PAUSE (keputusan K5). */
export type PausableStatus = "WAITING_READY" | "CAPTURING";

export type ShotSlot = { captured: boolean; uploaded: boolean };

export type SessionSnapshot = {
  status: BoothStatus;
  pausedFrom: PausableStatus | null;
  /** epoch ms */
  pausedAt: number | null;
  /** Shot yang sedang/akan dijepret saat CAPTURING. */
  currentShot: number | null;
  /** Shot yang sedang diulang (dari REVIEW); null pada putaran pertama. */
  retakeShot: number | null;
  /** epoch ms, jam server. */
  fireAt: number | null;
  /** epoch ms */
  expiresAt: number;
  hasGuest: boolean;
  ready: Record<Role, boolean>;
  /** Status foto versi terbaru per peserta per shot. */
  shots: Record<Role, ShotSlot[]>;
};

export type SessionEvent =
  | { type: "GUEST_JOINED" }
  | { type: "SET_READY"; role: Role; ready: boolean }
  | { type: "SHOT_CAPTURED"; role: Role; shotIndex: number }
  | { type: "PHOTO_UPLOADED"; role: Role; shotIndex: number }
  | { type: "COMPOSE_DONE" }
  | { type: "RETAKE"; shotIndex: number }
  | { type: "FINISH" }
  | { type: "PARTICIPANT_LOST" }
  | { type: "PARTICIPANT_BACK" };

export type SessionEffect =
  { type: "SHOT_SCHEDULED"; shotIndex: number; fireAt: number } | { type: "START_COMPOSE" };

export type TransitionError = "INVALID_STATE" | "WRONG_SHOT" | "NOT_CAPTURED" | "PHOTOS_INCOMPLETE";

export type TransitionResult =
  { ok: true; next: SessionSnapshot; effects: SessionEffect[] } | { ok: false; error: TransitionError };

export function emptyShots(): Record<Role, ShotSlot[]> {
  const slots = () => Array.from({ length: SHOTS_PER_PERSON }, () => ({ captured: false, uploaded: false }));
  return { host: slots(), guest: slots() };
}

const isShotIndex = (i: number) => Number.isInteger(i) && i >= 0 && i < SHOTS_PER_PERSON;

export const allUploaded = (s: SessionSnapshot) =>
  ROLES.every((role) => s.shots[role].every((slot) => slot.captured && slot.uploaded));

const cloneShots = (shots: Record<Role, ShotSlot[]>) => ({
  host: shots.host.map((slot) => ({ ...slot })),
  guest: shots.guest.map((slot) => ({ ...slot })),
});

const fail = (error: TransitionError): TransitionResult => ({ ok: false, error });
const unchanged = (s: SessionSnapshot): TransitionResult => ({ ok: true, next: s, effects: [] });

function schedule(s: SessionSnapshot, shotIndex: number, now: number): TransitionResult {
  const fireAt = now + SHOT_LEAD_MS;
  return {
    ok: true,
    next: { ...s, status: "CAPTURING", currentShot: shotIndex, fireAt },
    effects: [{ type: "SHOT_SCHEDULED", shotIndex, fireAt }],
  };
}

export function transition(s: SessionSnapshot, event: SessionEvent, now: number): TransitionResult {
  switch (event.type) {
    case "GUEST_JOINED":
      if (s.status !== "WAITING_GUEST") return fail("INVALID_STATE");
      return { ok: true, next: { ...s, status: "WAITING_READY", hasGuest: true }, effects: [] };

    case "SET_READY": {
      if (s.status !== "WAITING_READY") return fail("INVALID_STATE");
      const ready = { ...s.ready, [event.role]: event.ready };
      const next = { ...s, ready };
      return ready.host && ready.guest ? schedule(next, 0, now) : { ok: true, next, effects: [] };
    }

    case "SHOT_CAPTURED": {
      if (s.status !== "CAPTURING" && s.status !== "COMPOSING") return fail("INVALID_STATE");
      const { role, shotIndex } = event;
      if (!isShotIndex(shotIndex)) return fail("WRONG_SHOT");
      // Konfirmasi ulang (retry jaringan, kirim ulang foto gagal) untuk foto yang sudah
      // tercatat: tanpa efek. Berlaku juga di COMPOSING, agar foto terakhir tetap bisa diunggah.
      if (s.shots[role][shotIndex].captured) return unchanged(s);
      if (s.status !== "CAPTURING" || shotIndex !== s.currentShot) return fail("WRONG_SHOT");

      const shots = cloneShots(s.shots);
      shots[role][shotIndex].captured = true;
      const next = { ...s, shots };
      const bothDone = ROLES.every((r) => shots[r][shotIndex].captured);
      if (!bothDone) return { ok: true, next, effects: [] };

      const isLast = s.retakeShot !== null || shotIndex === SHOTS_PER_PERSON - 1;
      if (!isLast) return schedule(next, shotIndex + 1, now);
      return {
        ok: true,
        next: { ...next, status: "COMPOSING", currentShot: null, fireAt: null },
        // Unggahan bisa saja sudah lengkap lebih dulu (mis. retake di jaringan cepat).
        effects: allUploaded(next) ? [{ type: "START_COMPOSE" }] : [],
      };
    }

    case "PHOTO_UPLOADED": {
      if (s.status !== "CAPTURING" && s.status !== "COMPOSING") return fail("INVALID_STATE");
      const { role, shotIndex } = event;
      if (!isShotIndex(shotIndex)) return fail("WRONG_SHOT");
      if (!s.shots[role][shotIndex].captured) return fail("NOT_CAPTURED");
      if (s.shots[role][shotIndex].uploaded) return unchanged(s);

      const shots = cloneShots(s.shots);
      shots[role][shotIndex].uploaded = true;
      const next = { ...s, shots };
      const compose = next.status === "COMPOSING" && allUploaded(next);
      return { ok: true, next, effects: compose ? [{ type: "START_COMPOSE" }] : [] };
    }

    case "COMPOSE_DONE":
      if (s.status !== "COMPOSING") return fail("INVALID_STATE");
      if (!allUploaded(s)) return fail("PHOTOS_INCOMPLETE");
      return { ok: true, next: { ...s, status: "REVIEW", retakeShot: null }, effects: [] };

    case "RETAKE": {
      if (s.status !== "REVIEW") return fail("INVALID_STATE");
      if (!isShotIndex(event.shotIndex)) return fail("WRONG_SHOT");
      const shots = cloneShots(s.shots);
      for (const role of ROLES) shots[role][event.shotIndex] = { captured: false, uploaded: false };
      return schedule({ ...s, shots, retakeShot: event.shotIndex }, event.shotIndex, now);
    }

    case "FINISH":
      if (s.status !== "REVIEW") return fail("INVALID_STATE");
      return { ok: true, next: { ...s, status: "DONE" }, effects: [] };

    case "PARTICIPANT_LOST":
      if (s.status !== "WAITING_READY" && s.status !== "CAPTURING") return unchanged(s);
      return {
        ok: true,
        next: { ...s, status: "PAUSED", pausedFrom: s.status, pausedAt: now, fireAt: null },
        effects: [],
      };

    case "PARTICIPANT_BACK": {
      if (s.status !== "PAUSED" || s.pausedFrom === null) return unchanged(s);
      const resumed = { ...s, pausedFrom: null, pausedAt: null };
      if (s.pausedFrom === "CAPTURING" && s.currentShot !== null) {
        return schedule(resumed, s.currentShot, now);
      }
      // Kembali ke ruang tunggu: keduanya menekan "Siap!" lagi.
      return {
        ok: true,
        next: { ...resumed, status: "WAITING_READY", ready: { host: false, guest: false } },
        effects: [],
      };
    }
  }
}

/**
 * Menerapkan batas waktu yang tidak bisa dijalankan sebagai timer di server
 * (Vercel tidak menahan proses). Dipanggil di setiap request; null = tidak ada perubahan.
 */
export function reconcile(s: SessionSnapshot, now: number): { next: SessionSnapshot } | null {
  if (s.status === "DONE" || s.status === "EXPIRED") return null;

  const pausedTooLong = s.status === "PAUSED" && s.pausedAt !== null && now - s.pausedAt >= PAUSE_TIMEOUT_MS;
  if (now < s.expiresAt && !pausedTooLong) return null;

  return {
    next: { ...s, status: "EXPIRED", pausedFrom: null, pausedAt: null, fireAt: null },
  };
}
