import "server-only";
import { boothChannel } from "./realtime-token";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Menyiarkan event server → klien lewat REST Realtime (tanpa menahan WebSocket).
 * Gagal siar tidak menggagalkan request: klien juga menerima state di respons HTTP
 * dan memuat ulang snapshot saat tersambung kembali.
 */
export async function broadcast(boothId: string, event: string, payload: Record<string, unknown>) {
  const admin = supabaseAdmin();
  const channel = admin.channel(boothChannel(boothId), { config: { private: true } });
  try {
    await channel.httpSend(event, payload);
  } catch (err) {
    console.error("[broadcast] gagal", { event, message: (err as Error).message });
  } finally {
    void admin.removeChannel(channel);
  }
}
