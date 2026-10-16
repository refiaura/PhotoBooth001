import type { LocalSupabase } from "./supabase-global-setup";

/**
 * Mengisi process.env agar modul server (serverEnv) memakai Supabase lokal.
 * Panggil SEBELUM meng-import route handler, karena env di-cache saat pertama dipakai.
 */
export function useLocalServerEnv(supabase: LocalSupabase, overrides: Record<string, string> = {}) {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: supabase.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    SUPABASE_JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long",
    ACCESS_CODE: "kode-akses-untuk-tes",
    CRON_SECRET: "cron-secret-untuk-tes-integrasi",
    TURN_KEY_ID: "",
    TURN_KEY_API_TOKEN: "",
    ...overrides,
  });
}
