import { describe, expect, it } from "vitest";
import { emptyShots, type SessionSnapshot } from "@/domain/session-machine";
import { rowToSnapshot, snapshotToPatch, toPublicSession, type BoothRow } from "@/server/booth-snapshot";

const row: BoothRow = {
  id: "8d0f3c3e-1b0c-4c2e-9d55-111111111111",
  code: "ABC234",
  status: "CAPTURING",
  paused_from: null,
  paused_at: null,
  current_shot: 1,
  retake_shot: null,
  theme_id: "kangen-berat",
  caption: null,
  strip_date: null,
  show_mark: true,
  version: 7,
  created_at: "2026-10-17T10:00:00.000Z",
  expires_at: "2026-10-18T10:00:00.000Z",
  ready_host: true,
  ready_guest: true,
  shots: emptyShots(),
  shot_fire_at: "2026-10-17T10:05:00.000Z",
  compose_started_at: null,
  strip_slug: null,
};

describe("rowToSnapshot", () => {
  it("memetakan kolom DB ke snapshot domain (waktu → epoch ms)", () => {
    const s = rowToSnapshot(row, true);
    expect(s).toEqual<SessionSnapshot>({
      status: "CAPTURING",
      pausedFrom: null,
      pausedAt: null,
      currentShot: 1,
      retakeShot: null,
      fireAt: Date.parse("2026-10-17T10:05:00.000Z"),
      expiresAt: Date.parse("2026-10-18T10:00:00.000Z"),
      hasGuest: true,
      ready: { host: true, guest: true },
      shots: emptyShots(),
    });
  });

  it("menolak kolom shots yang rusak", () => {
    expect(() => rowToSnapshot({ ...row, shots: { host: [] } }, true)).toThrow();
  });

  it("menolak paused_from yang tidak bisa di-pause", () => {
    expect(() =>
      rowToSnapshot({ ...row, status: "PAUSED", paused_from: "REVIEW", paused_at: row.created_at }, true),
    ).toThrow();
  });
});

describe("snapshotToPatch", () => {
  it("bolak-balik: patch dari snapshot menghasilkan snapshot yang sama", () => {
    const s = rowToSnapshot(row, true);
    const patched = { ...row, ...snapshotToPatch(s) };
    expect(rowToSnapshot(patched, true)).toEqual(s);
  });

  it("tidak menyentuh kolom di luar state machine", () => {
    const patch = snapshotToPatch(rowToSnapshot(row, true));
    expect(Object.keys(patch).sort()).toEqual(
      [
        "current_shot",
        "paused_at",
        "paused_from",
        "ready_guest",
        "ready_host",
        "retake_shot",
        "shot_fire_at",
        "shots",
        "status",
      ].sort(),
    );
  });
});

describe("toPublicSession", () => {
  it("tidak membocorkan id internal, hanya data yang dibutuhkan klien", () => {
    const pub = toPublicSession(row, true, 123);
    expect(pub).toMatchObject({
      code: "ABC234",
      status: "CAPTURING",
      currentShot: 1,
      fireAt: Date.parse(row.shot_fire_at!),
      hasGuest: true,
      themeId: "kangen-berat",
      stripSlug: null,
      serverNow: 123,
    });
    expect(JSON.stringify(pub)).not.toContain(row.id);
  });
});
