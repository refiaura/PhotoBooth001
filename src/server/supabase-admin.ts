import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { serverEnv } from "./env";

export type AdminClient = SupabaseClient<Database>;

let client: AdminClient | undefined;

/**
 * Klien service role: melewati RLS, jadi HANYA dipakai di API route / server.
 * Jangan pernah mengirim hasilnya mentah ke browser.
 */
export function supabaseAdmin(): AdminClient {
  if (!client) {
    const env = serverEnv();
    client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
