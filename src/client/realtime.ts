import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Role } from "@/domain/session-machine";
import type { PublicSession } from "./api";
import { supabaseBrowser } from "./supabase-browser";

export type RtcSignal = {
  from: Role;
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
  onState: (session: PublicSession) => void;
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
    .on("broadcast", { event: "session:state" }, ({ payload }) => params.onState(payload as PublicSession))
    .on("broadcast", { event: "rtc:signal" }, ({ payload }) => {
      const signal = payload as RtcSignal;
      if (signal.from !== params.role) params.onSignal(signal);
    })
    .on("presence", { event: "sync" }, () => {
      params.onPresence(Object.keys(channel.presenceState()) as Role[]);
    });

  params.onStatus("connecting");
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ role: params.role, at: Date.now() });
      params.onStatus("connected");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      params.onStatus("error");
    }
  });

  return {
    sendSignal: (signal) => void channel.send({ type: "broadcast", event: "rtc:signal", payload: signal }),
    close: () => void client.removeChannel(channel),
  };
}
