import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Role } from "@/domain/session-machine";
import { supabaseBrowser } from "./supabase-browser";

export type RtcSignal = {
  from: Role;
  /** Tamu mengumumkan dirinya siap menerima offer (mis. setelah refresh atau kamera baru menyala). */
  hello?: true;
  /** Id koneksi WebRTC (dibuat host per offer); sinyal dari koneksi lama diabaikan. */
  linkId?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

export type RealtimeStatus = "connecting" | "connected" | "error";

export type BoothRealtime = {
  sendSignal: (signal: RtcSignal) => void;
  close: () => void;
};

/**
 * Kanal privat booth: server menyiarkan `session:state`, peserta saling mengirim
 * `rtc:signal` (SDP/ICE), dan presence menandai siapa yang sedang online.
 */
export async function connectBoothRealtime(params: {
  channel: string;
  token: string;
  role: Role;
  /**
   * Dipanggil saat ada siaran `session:state`. Isinya sengaja TIDAK dipakai: peserta lain
   * secara teknis bisa mengirim event dengan nama yang sama, jadi klien mengambil ulang state
   * dari API (terautentikasi) sebagai sumber kebenaran.
   */
  onStateChanged: () => void;
  onSignal: (signal: RtcSignal) => void;
  onPresence: (online: Role[]) => void;
  onStatus: (status: RealtimeStatus) => void;
}): Promise<BoothRealtime> {
  const client = supabaseBrowser();
  await client.realtime.setAuth(params.token);

  const channel: RealtimeChannel = client.channel(params.channel, {
    config: { private: true, presence: { key: params.role }, broadcast: { self: false } },
  });

  channel
    .on("broadcast", { event: "session:state" }, () => params.onStateChanged())
    .on("broadcast", { event: "rtc:signal" }, ({ payload }) => {
      const signal = payload as RtcSignal;
      if (signal.from !== params.role) params.onSignal(signal);
    })
    .on("presence", { event: "sync" }, () => {
      params.onPresence(Object.keys(channel.presenceState()) as Role[]);
    });

  params.onStatus("connecting");
  channel.subscribe(async (status, err) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ role: params.role, at: Date.now() });
      params.onStatus("connected");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[realtime] kanal bermasalah, beralih ke polling", status, err?.message ?? "");
      params.onStatus("error");
    }
  });

  return {
    sendSignal: (signal) => void channel.send({ type: "broadcast", event: "rtc:signal", payload: signal }),
    close: () => void client.removeChannel(channel),
  };
}
