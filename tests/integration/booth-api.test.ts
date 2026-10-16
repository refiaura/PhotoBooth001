import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { SHOT_LEAD_MS } from "@/domain/session-machine";
import { call, randomIp } from "../support/api";
import { useLocalServerEnv } from "../support/server-env";

// connection() hanya bisa dipanggil di dalam request Next.js; di tes route dipanggil langsung.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const supabase = inject("supabase");
const ACCESS_CODE = "kode-akses-untuk-tes";

// Route handler di-import setelah env diisi (serverEnv di-cache saat pertama dipakai).
let routes: {
  time: typeof import("@/app/api/time/route");
  booths: typeof import("@/app/api/booths/route");
  booth: typeof import("@/app/api/booths/[code]/route");
  join: typeof import("@/app/api/booths/[code]/join/route");
  session: typeof import("@/app/api/booths/[code]/session/route");
  ready: typeof import("@/app/api/booths/[code]/ready/route");
  uploadUrl: typeof import("@/app/api/booths/[code]/photos/upload-url/route");
  photos: typeof import("@/app/api/booths/[code]/photos/route");
  strips: typeof import("@/app/api/booths/[code]/strips/route");
  strip: typeof import("@/app/api/strips/[slug]/route");
  state: typeof import("@/app/api/booths/[code]/state/route");
};

beforeAll(async () => {
  useLocalServerEnv(supabase, { ACCESS_CODE });
  routes = {
    time: await import("@/app/api/time/route"),
    booths: await import("@/app/api/booths/route"),
    booth: await import("@/app/api/booths/[code]/route"),
    join: await import("@/app/api/booths/[code]/join/route"),
    session: await import("@/app/api/booths/[code]/session/route"),
    ready: await import("@/app/api/booths/[code]/ready/route"),
    uploadUrl: await import("@/app/api/booths/[code]/photos/upload-url/route"),
    photos: await import("@/app/api/booths/[code]/photos/route"),
    strips: await import("@/app/api/booths/[code]/strips/route"),
    strip: await import("@/app/api/strips/[slug]/route"),
    state: await import("@/app/api/booths/[code]/state/route"),
  };
});

const anon = createClient(supabase.url, supabase.anonKey, { auth: { persistSession: false } });
const admin = createClient(supabase.url, supabase.serviceRoleKey, { auth: { persistSession: false } });
const channels: RealtimeChannel[] = [];
afterAll(async () => {
  await Promise.all(channels.map((c) => c.unsubscribe()));
});

type Session = {
  status: string;
  currentShot: number | null;
  fireAt: number | null;
  stripSlug: string | null;
};

async function createBooth() {
  const res = await call<{ code: string; token: string; inviteUrl: string }>(routes.booths.POST, {
    body: { accessCode: ACCESS_CODE },
  });
  expect(res.status).toBe(201);
  return res.body;
}

async function joinAsGuest(code: string) {
  const res = await call<{ token: string; role: string; session: Session }>(routes.join.POST, {
    params: { code },
    body: {},
  });
  expect(res.status).toBe(201);
  return res.body;
}

async function setReady(code: string, token: string) {
  return call<{ session: Session }>(routes.ready.POST, { params: { code }, token, body: { ready: true } });
}

const webp = (color: string) =>
  sharp({ create: { width: 1280, height: 720, channels: 3, background: color } })
    .webp({ quality: 85 })
    .toBuffer();

/** Alur klien untuk satu jepretan: minta URL (= captured), unggah langsung ke Storage, konfirmasi. */
async function captureAndUpload(code: string, token: string, shotIndex: number, color: string) {
  const url = await call<{ photoId: string; uploaded: boolean; path: string; token: string }>(
    routes.uploadUrl.POST,
    { params: { code }, token, body: { shotIndex, mimeType: "image/webp" } },
  );
  expect(url.status).toBe(200);
  expect(url.body.uploaded).toBe(false);

  const up = await anon.storage
    .from("booth-media")
    .uploadToSignedUrl(url.body.path, url.body.token, await webp(color), { contentType: "image/webp" });
  expect(up.error).toBeNull();

  return url.body.photoId;
}

async function confirm(code: string, token: string, photoId: string) {
  return call<{ session: Session }>(routes.photos.POST, { params: { code }, token, body: { photoId } });
}

describe("GET /api/time", () => {
  it("mengembalikan jam server", async () => {
    const before = Date.now();
    const res = await call<{ now: number }>(routes.time.GET);
    expect(res.body.now).toBeGreaterThanOrEqual(before);
    expect(res.body.now).toBeLessThanOrEqual(Date.now());
  });
});

describe("POST /api/booths", () => {
  it("menolak kode akses salah (403)", async () => {
    const res = await call(routes.booths.POST, { body: { accessCode: "salah-banget" } });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "WRONG_ACCESS_CODE" });
  });

  it("menolak body tidak valid (400)", async () => {
    const res = await call(routes.booths.POST, { body: { kode: 1 } });
    expect(res.status).toBe(400);
  });

  it("membuat booth: kode 6 karakter, link undangan, token host", async () => {
    const booth = await createBooth();
    expect(booth.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    expect(booth.inviteUrl).toBe(`http://localhost:3000/b/${booth.code}`);
    expect(booth.token.length).toBeGreaterThanOrEqual(43);
  });

  it("rate limit per IP: percobaan ke-11 dalam 10 menit ditolak (429)", async () => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call(routes.booths.POST, { ip, body: { accessCode: "tebak" } })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 403)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("join dan info booth", () => {
  it("info publik: belum penuh, menunggu tamu", async () => {
    const { code } = await createBooth();
    const res = await call(routes.booth.GET, { params: { code } });
    expect(res.body).toMatchObject({ code, status: "WAITING_GUEST", full: false });
  });

  it("kode yang formatnya mustahil → 404", async () => {
    const res = await call(routes.booth.GET, { params: { code: "OOOOOO" } });
    expect(res.status).toBe(404);
  });

  it("tamu masuk: status WAITING_READY; orang ketiga melihat booth penuh (409)", async () => {
    const { code } = await createBooth();
    const guest = await joinAsGuest(code);
    expect(guest.role).toBe("guest");
    expect(guest.session.status).toBe("WAITING_READY");

    const third = await call(routes.join.POST, { params: { code }, body: {} });
    expect(third.status).toBe(409);
    expect(third.body).toEqual({ error: "FULL" });
  });

  it("rejoin dengan token lama tidak membuat peserta baru", async () => {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);

    const again = await call<{ token: string; role: string }>(routes.join.POST, {
      params: { code },
      body: { token: guest.token },
    });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ token: guest.token, role: "guest" });

    const host = await call<{ role: string }>(routes.join.POST, { params: { code }, body: { token } });
    expect(host.body.role).toBe("host");
  });

  it("dua tamu bersamaan: tepat satu yang berhasil", async () => {
    const { code } = await createBooth();
    const results = await Promise.all([
      call(routes.join.POST, { params: { code }, body: {} }),
      call(routes.join.POST, { params: { code }, body: {} }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("otorisasi peserta", () => {
  it("tanpa token atau dengan token booth lain → 401", async () => {
    const a = await createBooth();
    const b = await createBooth();
    expect((await call(routes.session.GET, { params: { code: a.code } })).status).toBe(401);
    expect((await call(routes.session.GET, { params: { code: a.code }, token: b.token })).status).toBe(401);
  });

  it("session: snapshot + token Realtime + ICE server", async () => {
    const { code, token } = await createBooth();
    const res = await call<{
      role: string;
      session: Session;
      realtime: { channel: string; token: string };
      iceServers: unknown[];
    }>(routes.session.GET, { params: { code }, token });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("host");
    expect(res.body.realtime.channel).toMatch(/^booth:[0-9a-f-]{36}$/);
    expect(res.body.iceServers.length).toBeGreaterThan(0);
  });
});

describe("alur sesi lengkap: 4 jepretan × 2 orang → photostrip", () => {
  it("jadwal, jepretan bersamaan, unggah, komposisi, unduh", async () => {
    const { code, token: hostToken } = await createBooth();
    const { token: guestToken } = await joinAsGuest(code);

    const hostReady = await setReady(code, hostToken);
    expect(hostReady.body.session.status).toBe("WAITING_READY");

    const before = Date.now();
    const bothReady = await setReady(code, guestToken);
    expect(bothReady.body.session.status).toBe("CAPTURING");
    expect(bothReady.body.session.currentShot).toBe(0);
    expect(bothReady.body.session.fireAt).toBeGreaterThanOrEqual(before + SHOT_LEAD_MS);

    const photoIds: Array<[string, string]> = [];
    for (let shot = 0; shot < 4; shot++) {
      // Kedua peserta mengonfirmasi jepretan PADA SAAT YANG SAMA (uji compare-and-swap).
      const [h, g] = await Promise.all([
        captureAndUpload(code, hostToken, shot, "#3a86ff"),
        captureAndUpload(code, guestToken, shot, "#ff006e"),
      ]);
      photoIds.push([hostToken, h], [guestToken, g]);

      const state = await call<{ session: Session }>(routes.session.GET, {
        params: { code },
        token: hostToken,
      });
      if (shot < 3) {
        expect(state.body.session.status).toBe("CAPTURING");
        expect(state.body.session.currentShot).toBe(shot + 1);
      } else {
        expect(state.body.session.status).toBe("COMPOSING");
      }
    }

    // Konfirmasi unggahan bersamaan; yang terakhir memicu komposisi tepat sekali.
    const confirmations = await Promise.all(photoIds.map(([t, id]) => confirm(code, t, id)));
    expect(confirmations.every((c) => c.status === 200)).toBe(true);

    const final = await call<{ session: Session }>(routes.session.GET, {
      params: { code },
      token: guestToken,
    });
    expect(final.body.session.status).toBe("REVIEW");
    const slug = final.body.session.stripSlug!;
    expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const strip = await call<{ strip: { url: string; downloadUrl: string } }>(routes.strip.GET, {
      params: { slug },
    });
    expect(strip.status).toBe(200);
    const png = Buffer.from(await (await fetch(strip.body.strip.url)).arrayBuffer());
    const meta = await sharp(png).metadata();
    expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({
      format: "png",
      width: 600,
      height: 1800,
    });

    const download = await fetch(strip.body.strip.downloadUrl);
    expect(download.headers.get("content-disposition")).toContain("attachment");

    // Memicu ulang komposisi setelah selesai tidak membuat strip baru.
    const again = await call<{ session: Session }>(routes.strips.POST, {
      params: { code },
      token: hostToken,
    });
    expect(again.body.session.stripSlug).toBe(slug);
  });

  it("menolak jepretan yang bukan gilirannya (409)", async () => {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);
    await setReady(code, token);
    await setReady(code, guest.token);

    const res = await call(routes.uploadUrl.POST, {
      params: { code },
      token,
      body: { shotIndex: 2, mimeType: "image/webp" },
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "WRONG_SHOT" });
  });

  it("menolak file yang bukan gambar dan menghapusnya dari Storage (422)", async () => {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);
    await setReady(code, token);
    await setReady(code, guest.token);

    const url = await call<{ photoId: string; path: string; token: string }>(routes.uploadUrl.POST, {
      params: { code },
      token,
      body: { shotIndex: 0, mimeType: "image/webp" },
    });
    await anon.storage
      .from("booth-media")
      .uploadToSignedUrl(
        url.body.path,
        url.body.token,
        new Blob(["<html>bukan foto</html>"], { type: "image/webp" }),
        {
          contentType: "image/webp",
        },
      );

    const res = await confirm(code, token, url.body.photoId);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "BAD_TYPE" });
  });

  it("peserta tidak bisa mengonfirmasi foto milik orang lain (404)", async () => {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);
    await setReady(code, token);
    await setReady(code, guest.token);
    const photoId = await captureAndUpload(code, token, 0, "#ffbe0b");

    const res = await confirm(code, guest.token, photoId);
    expect(res.status).toBe(404);
  });
});

describe("ketahanan: sesi tidak boleh macet", () => {
  type Shots = { host: Array<{ captured: boolean; uploaded: boolean }> };

  async function startCapturing() {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);
    await setReady(code, token);
    await setReady(code, guest.token);
    return { code, hostToken: token, guestToken: guest.token };
  }

  it("GET state ringan: snapshot tanpa token Realtime/TURN", async () => {
    const { code, hostToken } = await startCapturing();
    const res = await call<{ role: string; session: Session } & Record<string, unknown>>(routes.state.GET, {
      params: { code },
      token: hostToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("host");
    expect(res.body.session.status).toBe("CAPTURING");
    expect(res.body).not.toHaveProperty("iceServers");
    expect(res.body).not.toHaveProperty("realtime");
    expect((await call(routes.state.GET, { params: { code } })).status).toBe(401);
  });

  it("minta upload URL ulang untuk shot terakhir setelah COMPOSING tetap berhasil", async () => {
    const { code, hostToken, guestToken } = await startCapturing();
    for (let shot = 0; shot < 4; shot++) {
      await Promise.all([
        captureAndUpload(code, hostToken, shot, "#111111"),
        captureAndUpload(code, guestToken, shot, "#222222"),
      ]);
    }
    const retry = await call(routes.uploadUrl.POST, {
      params: { code },
      token: hostToken,
      body: { shotIndex: 3, mimeType: "image/webp" },
    });
    expect(retry.status).toBe(200);
    // File sudah ada di Storage: server tidak memberi URL untuk menimpanya, klien lanjut konfirmasi.
    expect(retry.body).toMatchObject({ uploaded: true });
    expect(retry.body).not.toHaveProperty("token");
  });

  it("konfirmasi ulang memulihkan tanda unggahan bila event sebelumnya gagal tersimpan", async () => {
    const { code, hostToken } = await startCapturing();
    const photoId = await captureAndUpload(code, hostToken, 0, "#333333");
    // Simulasi: file sudah ditandai terunggah, tetapi transisi state gagal (mis. 503 BUSY).
    await admin.from("photos").update({ uploaded_at: new Date().toISOString() }).eq("id", photoId);

    const res = await call<{ session: Session & { shots: Shots } }>(routes.photos.POST, {
      params: { code },
      token: hostToken,
      body: { photoId },
    });
    expect(res.status).toBe(200);
    expect(res.body.session.shots.host[0].uploaded).toBe(true);
  });

  it("komposisi yang gagal melepas klaimnya; konfirmasi foto tetap 200", async () => {
    const { code, hostToken, guestToken } = await startCapturing();
    const ids: Array<[string, string]> = [];
    for (let shot = 0; shot < 4; shot++) {
      const [h, g] = await Promise.all([
        captureAndUpload(code, hostToken, shot, "#444444"),
        captureAndUpload(code, guestToken, shot, "#555555"),
      ]);
      ids.push([hostToken, h], [guestToken, g]);
    }
    // Konfirmasi semua kecuali satu, lalu hapus file salah satu foto yang sudah terkonfirmasi.
    const last = ids.pop()!;
    for (const [t, photoId] of ids) expect((await confirm(code, t, photoId)).status).toBe(200);
    const { data: broken } = await admin.from("photos").select("storage_key").eq("id", ids[0][1]).single();
    await admin.storage.from("booth-media").remove([broken!.storage_key]);

    const res = await confirm(code, last[0], last[1]);
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("COMPOSING");

    const { data: booth } = await admin.from("booths").select("compose_started_at").eq("code", code).single();
    expect(booth!.compose_started_at).toBeNull();
  });

  it("klaim komposisi dikosongkan lagi setelah strip jadi", async () => {
    const { code, hostToken, guestToken } = await startCapturing();
    const ids: Array<[string, string]> = [];
    for (let shot = 0; shot < 4; shot++) {
      const [h, g] = await Promise.all([
        captureAndUpload(code, hostToken, shot, "#666666"),
        captureAndUpload(code, guestToken, shot, "#777777"),
      ]);
      ids.push([hostToken, h], [guestToken, g]);
    }
    for (const [t, photoId] of ids) await confirm(code, t, photoId);

    const { data: booth } = await admin
      .from("booths")
      .select("status, compose_started_at")
      .eq("code", code)
      .single();
    expect(booth).toEqual({ status: "REVIEW", compose_started_at: null });
  });
});

describe("Realtime: kanal privat per booth", () => {
  async function realtimeFor(code: string, token: string) {
    const res = await call<{ realtime: { channel: string; token: string } }>(routes.session.GET, {
      params: { code },
      token,
    });
    return res.body.realtime;
  }

  async function subscribe(channelName: string, jwt: string) {
    const client = createClient(supabase.url, supabase.anonKey, { auth: { persistSession: false } });
    await client.realtime.setAuth(jwt);
    const channel = client.channel(channelName, { config: { private: true } });
    channels.push(channel);
    const received: Array<{ event: string; payload: unknown }> = [];
    channel.on("broadcast", { event: "*" }, (msg) =>
      received.push({ event: msg.event, payload: msg.payload }),
    );
    const status = new Promise<string>((resolve) =>
      channel.subscribe((s) => {
        if (s !== "CLOSED") resolve(s);
      }),
    );
    return { channel, received, status };
  }

  it("peserta menerima siaran server di kanal booth-nya", async () => {
    const { code, token } = await createBooth();
    const rt = await realtimeFor(code, token);
    const sub = await subscribe(rt.channel, rt.token);
    expect(await sub.status).toBe("SUBSCRIBED");

    await joinAsGuest(code); // memicu siaran session:state
    await expect
      .poll(() => sub.received.find((m) => m.event === "session:state")?.payload, { timeout: 5000 })
      .toMatchObject({ code, status: "WAITING_READY" });
  });

  it("token booth A ditolak di kanal booth B", async () => {
    const a = await createBooth();
    const b = await createBooth();
    const rtA = await realtimeFor(a.code, a.token);
    const rtB = await realtimeFor(b.code, b.token);

    const sub = await subscribe(rtB.channel, rtA.token);
    expect(await sub.status).not.toBe("SUBSCRIBED");
  });

  it("peserta bisa saling kirim rtc:signal di kanal booth", async () => {
    const { code, token } = await createBooth();
    const guest = await joinAsGuest(code);
    const rtHost = await realtimeFor(code, token);
    const rtGuest = await realtimeFor(code, guest.token);
    const hostSub = await subscribe(rtHost.channel, rtHost.token);
    const guestSub = await subscribe(rtGuest.channel, rtGuest.token);
    expect(await hostSub.status).toBe("SUBSCRIBED");
    expect(await guestSub.status).toBe("SUBSCRIBED");

    await guestSub.channel.send({
      type: "broadcast",
      event: "rtc:signal",
      payload: { from: "guest", hello: true },
    });
    await expect
      .poll(() => hostSub.received.some((m) => m.event === "rtc:signal"), { timeout: 5000 })
      .toBe(true);
  });
});
