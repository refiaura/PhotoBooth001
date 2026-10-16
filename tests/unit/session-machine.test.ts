import { describe, expect, it } from "vitest";
import {
  PAUSE_TIMEOUT_MS,
  SHOT_LEAD_MS,
  SHOTS_PER_PERSON,
  emptyShots,
  reconcile,
  transition,
  type SessionSnapshot,
} from "@/domain/session-machine";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    status: "WAITING_GUEST",
    pausedFrom: null,
    pausedAt: null,
    currentShot: null,
    retakeShot: null,
    fireAt: null,
    expiresAt: NOW + 24 * HOUR,
    hasGuest: false,
    ready: { host: false, guest: false },
    shots: emptyShots(),
    ...overrides,
  };
}

/** Semua jepretan 0..n-1 sudah diambil (dan opsional sudah diunggah) oleh kedua peserta. */
function shotsDone(count: number, uploaded = false) {
  const shots = emptyShots();
  for (const role of ["host", "guest"] as const) {
    for (let i = 0; i < count; i++) shots[role][i] = { captured: true, uploaded };
  }
  return shots;
}

function ok(result: ReturnType<typeof transition>) {
  if (!result.ok) throw new Error(`transisi ditolak: ${result.error}`);
  return result;
}

describe("konstanta", () => {
  it("1 sesi = 4 jepretan per orang, jadwal ~3,5 detik ke depan", () => {
    expect(SHOTS_PER_PERSON).toBe(4);
    expect(SHOT_LEAD_MS).toBe(3500);
    expect(PAUSE_TIMEOUT_MS).toBe(2 * 60 * 1000);
  });
});

describe("GUEST_JOINED", () => {
  it("WAITING_GUEST → WAITING_READY", () => {
    const r = ok(transition(snapshot(), { type: "GUEST_JOINED" }, NOW));
    expect(r.next.status).toBe("WAITING_READY");
    expect(r.next.hasGuest).toBe(true);
  });

  it("ditolak di status lain", () => {
    const r = transition(snapshot({ status: "CAPTURING", hasGuest: true }), { type: "GUEST_JOINED" }, NOW);
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
  });
});

describe("SET_READY", () => {
  const waiting = snapshot({ status: "WAITING_READY", hasGuest: true });

  it("satu orang siap: tetap WAITING_READY", () => {
    const r = ok(transition(waiting, { type: "SET_READY", role: "host", ready: true }, NOW));
    expect(r.next.status).toBe("WAITING_READY");
    expect(r.next.ready).toEqual({ host: true, guest: false });
    expect(r.next.fireAt).toBeNull();
  });

  it("keduanya siap: CAPTURING, shot 0 dijadwalkan SHOT_LEAD_MS ke depan", () => {
    const hostReady = snapshot({ ...waiting, ready: { host: true, guest: false } });
    const r = ok(transition(hostReady, { type: "SET_READY", role: "guest", ready: true }, NOW));
    expect(r.next.status).toBe("CAPTURING");
    expect(r.next.currentShot).toBe(0);
    expect(r.next.fireAt).toBe(NOW + SHOT_LEAD_MS);
    expect(r.effects).toContainEqual({ type: "SHOT_SCHEDULED", shotIndex: 0, fireAt: NOW + SHOT_LEAD_MS });
  });

  it("batal siap", () => {
    const hostReady = snapshot({ ...waiting, ready: { host: true, guest: false } });
    const r = ok(transition(hostReady, { type: "SET_READY", role: "host", ready: false }, NOW));
    expect(r.next.ready.host).toBe(false);
  });

  it("ditolak sebelum tamu masuk", () => {
    expect(transition(snapshot(), { type: "SET_READY", role: "host", ready: true }, NOW)).toEqual({
      ok: false,
      error: "INVALID_STATE",
    });
  });
});

describe("SHOT_CAPTURED", () => {
  const capturing = (shot: number, extra: Partial<SessionSnapshot> = {}) =>
    snapshot({
      status: "CAPTURING",
      hasGuest: true,
      ready: { host: true, guest: true },
      currentShot: shot,
      fireAt: NOW - 100,
      shots: shotsDone(shot),
      ...extra,
    });

  it("satu orang selesai: menunggu pasangannya", () => {
    const r = ok(transition(capturing(0), { type: "SHOT_CAPTURED", role: "host", shotIndex: 0 }, NOW));
    expect(r.next.status).toBe("CAPTURING");
    expect(r.next.currentShot).toBe(0);
    expect(r.next.shots.host[0]).toEqual({ captured: true, uploaded: false });
    expect(r.effects).toEqual([]);
  });

  it("keduanya selesai: shot berikutnya dijadwalkan", () => {
    const s = capturing(0);
    s.shots.host[0] = { captured: true, uploaded: false };
    const r = ok(transition(s, { type: "SHOT_CAPTURED", role: "guest", shotIndex: 0 }, NOW));
    expect(r.next.currentShot).toBe(1);
    expect(r.next.fireAt).toBe(NOW + SHOT_LEAD_MS);
    expect(r.effects).toContainEqual({ type: "SHOT_SCHEDULED", shotIndex: 1, fireAt: NOW + SHOT_LEAD_MS });
  });

  it("shot terakhir selesai: COMPOSING, jadwal dihapus", () => {
    const s = capturing(3);
    s.shots.host[3] = { captured: true, uploaded: false };
    const r = ok(transition(s, { type: "SHOT_CAPTURED", role: "guest", shotIndex: 3 }, NOW));
    expect(r.next.status).toBe("COMPOSING");
    expect(r.next.currentShot).toBeNull();
    expect(r.next.fireAt).toBeNull();
  });

  it("idempoten: mengirim ulang konfirmasi yang sama tidak mengubah apa pun", () => {
    const s = capturing(1);
    s.shots.host[1] = { captured: true, uploaded: false };
    const r = ok(transition(s, { type: "SHOT_CAPTURED", role: "host", shotIndex: 1 }, NOW));
    expect(r.next).toEqual(s);
    expect(r.effects).toEqual([]);
  });

  it("menolak shot yang bukan giliran sekarang", () => {
    expect(transition(capturing(1), { type: "SHOT_CAPTURED", role: "host", shotIndex: 2 }, NOW)).toEqual({
      ok: false,
      error: "WRONG_SHOT",
    });
  });

  it("menerima ulang konfirmasi shot yang sudah lewat (retry jaringan) tanpa efek", () => {
    const r = ok(transition(capturing(2), { type: "SHOT_CAPTURED", role: "guest", shotIndex: 0 }, NOW));
    expect(r.next).toEqual(capturing(2));
  });

  it("menolak di luar CAPTURING", () => {
    expect(
      transition(snapshot({ status: "REVIEW" }), { type: "SHOT_CAPTURED", role: "host", shotIndex: 0 }, NOW),
    ).toEqual({ ok: false, error: "INVALID_STATE" });
  });
});

describe("PHOTO_UPLOADED", () => {
  it("menandai unggahan saat CAPTURING tanpa memulai komposisi", () => {
    const s = snapshot({ status: "CAPTURING", hasGuest: true, currentShot: 1, shots: shotsDone(1) });
    const r = ok(transition(s, { type: "PHOTO_UPLOADED", role: "host", shotIndex: 0 }, NOW));
    expect(r.next.shots.host[0].uploaded).toBe(true);
    expect(r.effects).toEqual([]);
  });

  it("unggahan terakhir saat COMPOSING memicu komposisi", () => {
    const s = snapshot({ status: "COMPOSING", hasGuest: true, shots: shotsDone(4, true) });
    s.shots.guest[3] = { captured: true, uploaded: false };
    const r = ok(transition(s, { type: "PHOTO_UPLOADED", role: "guest", shotIndex: 3 }, NOW));
    expect(r.next.status).toBe("COMPOSING");
    expect(r.effects).toEqual([{ type: "START_COMPOSE" }]);
  });

  it("menolak unggahan untuk foto yang belum diambil", () => {
    const s = snapshot({ status: "CAPTURING", hasGuest: true, currentShot: 0 });
    expect(transition(s, { type: "PHOTO_UPLOADED", role: "host", shotIndex: 0 }, NOW)).toEqual({
      ok: false,
      error: "NOT_CAPTURED",
    });
  });
});

describe("COMPOSE_DONE, RETAKE, FINISH", () => {
  const composing = snapshot({ status: "COMPOSING", hasGuest: true, shots: shotsDone(4, true) });

  it("COMPOSING → REVIEW", () => {
    const r = ok(transition(composing, { type: "COMPOSE_DONE" }, NOW));
    expect(r.next.status).toBe("REVIEW");
    expect(r.next.retakeShot).toBeNull();
  });

  it("COMPOSE_DONE ditolak bila foto belum lengkap", () => {
    const s = snapshot({ status: "COMPOSING", hasGuest: true, shots: shotsDone(3, true) });
    expect(transition(s, { type: "COMPOSE_DONE" }, NOW)).toEqual({ ok: false, error: "PHOTOS_INCOMPLETE" });
  });

  it("RETAKE dari REVIEW: CAPTURING hanya untuk shot itu, foto lain tetap", () => {
    const review = snapshot({ ...composing, status: "REVIEW" });
    const r = ok(transition(review, { type: "RETAKE", shotIndex: 2 }, NOW));
    expect(r.next.status).toBe("CAPTURING");
    expect(r.next.retakeShot).toBe(2);
    expect(r.next.currentShot).toBe(2);
    expect(r.next.fireAt).toBe(NOW + SHOT_LEAD_MS);
    expect(r.next.shots.host[2]).toEqual({ captured: false, uploaded: false });
    expect(r.next.shots.host[1]).toEqual({ captured: true, uploaded: true });
    expect(r.effects).toContainEqual({ type: "SHOT_SCHEDULED", shotIndex: 2, fireAt: NOW + SHOT_LEAD_MS });
  });

  it("selesai jepret ulang: langsung COMPOSING, tidak lanjut ke shot berikutnya", () => {
    const s = snapshot({
      status: "CAPTURING",
      hasGuest: true,
      currentShot: 1,
      retakeShot: 1,
      fireAt: NOW,
      shots: shotsDone(4, true),
    });
    s.shots.host[1] = { captured: true, uploaded: false };
    s.shots.guest[1] = { captured: false, uploaded: false };
    const r = ok(transition(s, { type: "SHOT_CAPTURED", role: "guest", shotIndex: 1 }, NOW));
    expect(r.next.status).toBe("COMPOSING");
    expect(r.next.currentShot).toBeNull();
  });

  it("RETAKE menolak indeks di luar 0..3", () => {
    const review = snapshot({ ...composing, status: "REVIEW" });
    expect(transition(review, { type: "RETAKE", shotIndex: 4 }, NOW)).toEqual({
      ok: false,
      error: "WRONG_SHOT",
    });
  });

  it("FINISH: REVIEW → DONE", () => {
    const r = ok(transition(snapshot({ ...composing, status: "REVIEW" }), { type: "FINISH" }, NOW));
    expect(r.next.status).toBe("DONE");
  });
});

describe("PAUSED", () => {
  it("peserta hilang saat CAPTURING: PAUSED, jadwal dibatalkan", () => {
    const s = snapshot({ status: "CAPTURING", hasGuest: true, currentShot: 2, fireAt: NOW + 1000 });
    const r = ok(transition(s, { type: "PARTICIPANT_LOST" }, NOW));
    expect(r.next.status).toBe("PAUSED");
    expect(r.next.pausedFrom).toBe("CAPTURING");
    expect(r.next.pausedAt).toBe(NOW);
    expect(r.next.fireAt).toBeNull();
    expect(r.next.currentShot).toBe(2);
  });

  it("peserta kembali: status semula, shot yang tertunda dijadwalkan ulang", () => {
    const s = snapshot({
      status: "PAUSED",
      pausedFrom: "CAPTURING",
      pausedAt: NOW - 30_000,
      hasGuest: true,
      currentShot: 2,
    });
    const r = ok(transition(s, { type: "PARTICIPANT_BACK" }, NOW));
    expect(r.next.status).toBe("CAPTURING");
    expect(r.next.pausedFrom).toBeNull();
    expect(r.next.pausedAt).toBeNull();
    expect(r.next.fireAt).toBe(NOW + SHOT_LEAD_MS);
    expect(r.effects).toContainEqual({ type: "SHOT_SCHEDULED", shotIndex: 2, fireAt: NOW + SHOT_LEAD_MS });
  });

  it("kembali ke WAITING_READY tanpa jadwal dan status siap direset", () => {
    const s = snapshot({
      status: "PAUSED",
      pausedFrom: "WAITING_READY",
      pausedAt: NOW,
      hasGuest: true,
      ready: { host: true, guest: false },
    });
    const r = ok(transition(s, { type: "PARTICIPANT_BACK" }, NOW));
    expect(r.next.status).toBe("WAITING_READY");
    expect(r.next.fireAt).toBeNull();
    expect(r.next.ready).toEqual({ host: false, guest: false });
  });

  it.each(["WAITING_GUEST", "COMPOSING", "REVIEW", "DONE"] as const)(
    "PARTICIPANT_LOST diabaikan di %s",
    (status) => {
      const s = snapshot({ status, hasGuest: status !== "WAITING_GUEST" });
      const r = ok(transition(s, { type: "PARTICIPANT_LOST" }, NOW));
      expect(r.next).toEqual(s);
    },
  );
});

describe("reconcile (batas waktu yang dihitung secara lazy)", () => {
  it("tidak mengubah apa pun bila belum ada yang lewat batas", () => {
    const s = snapshot({ status: "WAITING_READY", hasGuest: true });
    expect(reconcile(s, NOW)).toBeNull();
  });

  it("status apa pun selain DONE menjadi EXPIRED setelah 24 jam", () => {
    const s = snapshot({ status: "CAPTURING", hasGuest: true, currentShot: 1, fireAt: NOW - 10 });
    const r = reconcile(s, s.expiresAt);
    expect(r?.next.status).toBe("EXPIRED");
    expect(r?.next.fireAt).toBeNull();
    expect(r?.next.pausedFrom).toBeNull();
  });

  it("DONE dan EXPIRED tidak berubah", () => {
    expect(reconcile(snapshot({ status: "DONE" }), NOW + 48 * HOUR)).toBeNull();
    expect(reconcile(snapshot({ status: "EXPIRED" }), NOW + 48 * HOUR)).toBeNull();
  });

  it("PAUSED lebih dari 2 menit menjadi EXPIRED (keputusan K3)", () => {
    const s = snapshot({ status: "PAUSED", pausedFrom: "CAPTURING", pausedAt: NOW, hasGuest: true });
    expect(reconcile(s, NOW + PAUSE_TIMEOUT_MS - 1)).toBeNull();
    const r = reconcile(s, NOW + PAUSE_TIMEOUT_MS);
    expect(r?.next.status).toBe("EXPIRED");
    expect(r?.next.pausedFrom).toBeNull();
    expect(r?.next.pausedAt).toBeNull();
  });
});

describe("EXPIRED bersifat final", () => {
  it.each([
    { type: "GUEST_JOINED" },
    { type: "SET_READY", role: "host", ready: true },
    { type: "FINISH" },
  ] as const)("menolak %o", (event) => {
    expect(transition(snapshot({ status: "EXPIRED" }), event, NOW)).toEqual({
      ok: false,
      error: "INVALID_STATE",
    });
  });
});
