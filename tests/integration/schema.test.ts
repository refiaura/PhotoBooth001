import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { Database } from "@/server/database.types";

const { url, anonKey, serviceRoleKey } = inject("supabase");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceRoleKey, opts);
const anon: SupabaseClient<Database> = createClient<Database>(url, anonKey, opts);

const TABLES = ["themes", "booths", "participants", "photos", "strips", "rate_limit_hits"] as const;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(): string {
  return Array.from(randomBytes(6), (b) => ALPHABET[b % 32]).join("");
}

function tokenHash(): string {
  // PostgREST menerima bytea dalam format hex "\\x...".
  return `\\x${randomBytes(32).toString("hex")}`;
}

const createdBoothIds: string[] = [];

async function createBooth() {
  const { data, error } = await admin
    .from("booths")
    .insert({ code: randomCode(), theme_id: "kangen-berat" })
    .select()
    .single();
  if (error) throw error;
  createdBoothIds.push(data.id);
  return data;
}

async function addParticipant(boothId: string, role: "host" | "guest") {
  return admin
    .from("participants")
    .insert({ booth_id: boothId, role, token_hash: tokenHash() })
    .select()
    .single();
}

afterAll(async () => {
  if (createdBoothIds.length > 0) {
    await admin.from("booths").delete().in("id", createdBoothIds);
  }
});

describe("RLS: anon tidak punya akses ke tabel mana pun", () => {
  beforeAll(async () => {
    await createBooth();
  });

  it.each(TABLES)("anon tidak bisa membaca %s", async (table) => {
    const { data, error } = await anon.from(table).select("*").limit(1);
    // Hak SELECT dicabut, jadi PostgREST menolak dengan "permission denied" (42501).
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("anon tidak bisa membuat booth", async () => {
    const { error } = await anon.from("booths").insert({ code: randomCode(), theme_id: "kangen-berat" });
    expect(error?.code).toBe("42501");
  });

  it("anon tidak bisa memanggil hit_rate_limit", async () => {
    const { error } = await anon.rpc("hit_rate_limit", { p_key: "x", p_window_seconds: 60, p_max: 1 });
    expect(error).not.toBeNull();
  });
});

describe("constraint booth dan peserta", () => {
  it("booth baru berstatus WAITING_GUEST dan kedaluwarsa 24 jam kemudian", async () => {
    const booth = await createBooth();
    expect(booth.status).toBe("WAITING_GUEST");
    const ttlMs = Date.parse(booth.expires_at) - Date.parse(booth.created_at);
    expect(ttlMs).toBe(24 * 60 * 60 * 1000);
  });

  it("menolak kode dengan karakter ambigu", async () => {
    const { error } = await admin.from("booths").insert({ code: "ABCD0O", theme_id: "kangen-berat" });
    expect(error?.code).toBe("23514"); // check_violation
  });

  it("menolak caption lebih dari 40 karakter", async () => {
    const { error } = await admin
      .from("booths")
      .insert({ code: randomCode(), theme_id: "kangen-berat", caption: "x".repeat(41) });
    expect(error?.code).toBe("23514");
  });

  it("menolak status PAUSED tanpa paused_from", async () => {
    const booth = await createBooth();
    const { error } = await admin.from("booths").update({ status: "PAUSED" }).eq("id", booth.id);
    expect(error?.code).toBe("23514");
  });

  it("menolak sisa paused_at saat status bukan PAUSED", async () => {
    const booth = await createBooth();
    const { error } = await admin
      .from("booths")
      .update({ paused_at: new Date().toISOString() })
      .eq("id", booth.id);
    expect(error?.code).toBe("23514");
  });

  it("strip tetap ada (booth_id NULL) setelah booth dihapus, karena retensinya 30 hari", async () => {
    const booth = await createBooth();
    const slug = randomBytes(16).toString("base64url").slice(0, 22);
    const { data: strip, error } = await admin
      .from("strips")
      .insert({
        booth_id: booth.id,
        format: "strip",
        storage_key: `test/${randomUUID()}.png`,
        public_slug: slug,
      })
      .select()
      .single();
    expect(error).toBeNull();

    await admin.from("booths").delete().eq("id", booth.id);

    const { data: after } = await admin.from("strips").select("booth_id").eq("id", strip!.id).single();
    expect(after?.booth_id).toBeNull();
    await admin.from("strips").delete().eq("id", strip!.id);
  });

  it("booth hanya menerima satu host dan satu tamu (maksimal 2 peserta)", async () => {
    const booth = await createBooth();
    expect((await addParticipant(booth.id, "host")).error).toBeNull();
    expect((await addParticipant(booth.id, "guest")).error).toBeNull();

    const third = await addParticipant(booth.id, "guest");
    expect(third.error?.code).toBe("23505"); // unique_violation
  });

  it("foto harus milik peserta di booth yang sama", async () => {
    const boothA = await createBooth();
    const boothB = await createBooth();
    const { data: hostA } = await addParticipant(boothA.id, "host");

    const { error } = await admin.from("photos").insert({
      booth_id: boothB.id,
      participant_id: hostA!.id,
      shot_index: 0,
      storage_key: `test/${randomUUID()}.webp`,
    });
    expect(error?.code).toBe("23503"); // foreign_key_violation
  });

  it("menghapus booth ikut menghapus peserta dan foto", async () => {
    const booth = await createBooth();
    const { data: host } = await addParticipant(booth.id, "host");
    await admin.from("photos").insert({
      booth_id: booth.id,
      participant_id: host!.id,
      shot_index: 0,
      storage_key: `test/${randomUUID()}.webp`,
    });

    await admin.from("booths").delete().eq("id", booth.id);

    const { count } = await admin
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("booth_id", booth.id);
    expect(count).toBe(0);
  });
});

describe("hit_rate_limit", () => {
  it("mengizinkan sampai batas lalu menolak", async () => {
    const key = `test:${randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data, error } = await admin.rpc("hit_rate_limit", {
        p_key: key,
        p_window_seconds: 3600,
        p_max: 3,
      });
      expect(error).toBeNull();
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
    await admin.from("rate_limit_hits").delete().eq("key", key);
  });
});

describe("storage bucket booth-media", () => {
  it("bucket privat dengan batas 5 MB", async () => {
    const { data, error } = await admin.storage.getBucket("booth-media");
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(5 * 1024 * 1024);
  });

  it("anon tidak bisa mengunggah atau membaca file", async () => {
    const path = `test/${randomUUID()}.webp`;
    const upload = await anon.storage
      .from("booth-media")
      .upload(path, new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }));
    expect(upload.error).not.toBeNull();

    // File yang diunggah server tetap tidak bisa diunduh anon tanpa signed URL.
    await admin.storage
      .from("booth-media")
      .upload(path, new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }));
    const download = await anon.storage.from("booth-media").download(path);
    expect(download.error).not.toBeNull();

    const signed = await admin.storage.from("booth-media").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl);
    expect(res.status).toBe(200);

    await admin.storage.from("booth-media").remove([path]);
  });
});
