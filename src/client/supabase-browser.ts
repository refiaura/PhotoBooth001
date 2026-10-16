"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Klien anon untuk browser. Hanya dipakai untuk Supabase Realtime (broadcast + presence);
 * semua tabel tertutup bagi anon, jadi klien ini tidak bisa membaca data apa pun.
 */
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    // Harus ditulis literal agar Next.js menyisipkan nilainya saat build.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
