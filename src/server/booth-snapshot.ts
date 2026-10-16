import { z } from "zod";
import {
  SHOTS_PER_PERSON,
  type BoothStatus,
  type Role,
  type SessionSnapshot,
  type ShotSlot,
} from "@/domain/session-machine";
import type { Database } from "./database.types";

export type BoothRow = Database["public"]["Tables"]["booths"]["Row"];
export type BoothPatch = Database["public"]["Tables"]["booths"]["Update"];

const slot = z.object({ captured: z.boolean(), uploaded: z.boolean() });
const shotsSchema = z.object({
  host: z.array(slot).length(SHOTS_PER_PERSON),
  guest: z.array(slot).length(SHOTS_PER_PERSON),
});
const pausableSchema = z.enum(["WAITING_READY", "CAPTURING"]).nullable();

const toMs = (iso: string | null) => (iso === null ? null : Date.parse(iso));
const toIso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** Baris `booths` → snapshot domain. Memvalidasi kolom jsonb agar data rusak gagal keras. */
export function rowToSnapshot(row: BoothRow, hasGuest: boolean): SessionSnapshot {
  return {
    status: row.status,
    pausedFrom: pausableSchema.parse(row.paused_from),
    pausedAt: toMs(row.paused_at),
    currentShot: row.current_shot,
    retakeShot: row.retake_shot,
    fireAt: toMs(row.shot_fire_at),
    expiresAt: Date.parse(row.expires_at),
    hasGuest,
    ready: { host: row.ready_host, guest: row.ready_guest },
    shots: shotsSchema.parse(row.shots),
  };
}

/** Snapshot domain → kolom yang diubah state machine (hasGuest berasal dari tabel participants). */
export function snapshotToPatch(s: SessionSnapshot) {
  return {
    status: s.status,
    paused_from: s.pausedFrom,
    paused_at: toIso(s.pausedAt),
    current_shot: s.currentShot,
    retake_shot: s.retakeShot,
    shot_fire_at: toIso(s.fireAt),
    ready_host: s.ready.host,
    ready_guest: s.ready.guest,
    shots: s.shots,
  } satisfies BoothPatch;
}

/** State yang dikirim ke klien (respons HTTP dan event `session:state`). */
export type PublicSession = {
  code: string;
  status: BoothStatus;
  hasGuest: boolean;
  ready: Record<Role, boolean>;
  currentShot: number | null;
  retakeShot: number | null;
  /** jam server, epoch ms */
  fireAt: number | null;
  shots: Record<Role, ShotSlot[]>;
  expiresAt: number;
  themeId: string;
  stripSlug: string | null;
  /** jam server saat state ini dibuat, epoch ms */
  serverNow: number;
};

export function toPublicSession(row: BoothRow, hasGuest: boolean, now: number): PublicSession {
  const s = rowToSnapshot(row, hasGuest);
  return {
    code: row.code,
    status: s.status,
    hasGuest,
    ready: s.ready,
    currentShot: s.currentShot,
    retakeShot: s.retakeShot,
    fireAt: s.fireAt,
    shots: s.shots,
    expiresAt: s.expiresAt,
    themeId: row.theme_id,
    stripSlug: row.strip_slug,
    serverNow: now,
  };
}
