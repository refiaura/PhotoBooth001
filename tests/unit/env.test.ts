import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/server/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-yang-cukup-panjang-123",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-yang-cukup-panjang",
  SUPABASE_JWT_SECRET: "jwt-secret-minimal-tiga-puluh-dua-karakter!!",
  ACCESS_CODE: "kode-rahasia-kita",
  TURN_KEY_ID: "turn-key-id",
  TURN_KEY_API_TOKEN: "turn-api-token",
  CRON_SECRET: "cron-secret-yang-panjang",
};

function without(key: keyof typeof valid) {
  const copy: Record<string, string> = { ...valid };
  delete copy[key];
  return copy;
}

describe("parseServerEnv", () => {
  it("menerima konfigurasi lengkap", () => {
    const env = parseServerEnv(valid);
    expect(env.ACCESS_CODE).toBe("kode-rahasia-kita");
    expect(env.turn).toEqual({ keyId: "turn-key-id", apiToken: "turn-api-token" });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "ACCESS_CODE",
    "CRON_SECRET",
  ] as const)("gagal bila %s tidak ada, dengan pesan yang menyebut namanya", (key) => {
    expect(() => parseServerEnv(without(key))).toThrow(key);
  });

  it("pesan error tidak membocorkan nilai secret", () => {
    const bad = { ...valid, ACCESS_CODE: "pendek" };
    expect(() => parseServerEnv(bad)).toThrow("ACCESS_CODE");
    try {
      parseServerEnv(bad);
    } catch (err) {
      expect(String(err)).not.toContain("pendek");
      expect(String(err)).not.toContain(valid.SUPABASE_SERVICE_ROLE_KEY);
    }
  });

  it("ACCESS_CODE minimal 8 karakter", () => {
    expect(() => parseServerEnv({ ...valid, ACCESS_CODE: "1234567" })).toThrow("ACCESS_CODE");
  });

  it("SUPABASE_JWT_SECRET minimal 32 karakter", () => {
    expect(() => parseServerEnv({ ...valid, SUPABASE_JWT_SECRET: "x".repeat(31) })).toThrow(
      "SUPABASE_JWT_SECRET",
    );
  });

  it("NEXT_PUBLIC_SUPABASE_URL harus URL", () => {
    expect(() => parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "bukan-url" })).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  });

  it("TURN opsional: tanpa keduanya berarti hanya STUN", () => {
    const noTurn: Record<string, string> = without("TURN_KEY_ID");
    delete noTurn.TURN_KEY_API_TOKEN;
    expect(parseServerEnv(noTurn).turn).toBeNull();
  });

  it("TURN harus lengkap berpasangan", () => {
    expect(() => parseServerEnv(without("TURN_KEY_API_TOKEN"))).toThrow("TURN_KEY_API_TOKEN");
    expect(() => parseServerEnv(without("TURN_KEY_ID"))).toThrow("TURN_KEY_ID");
  });

  it("string kosong dianggap tidak diisi", () => {
    expect(() => parseServerEnv({ ...valid, CRON_SECRET: "" })).toThrow("CRON_SECRET");
  });
});
