import "server-only";
import { serverEnv } from "./env";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN_ONLY: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

/** Kredensial TURN berumur 1 jam (PRD bagian keamanan). */
const TURN_TTL_SECONDS = 3600;

/**
 * ICE server untuk satu sesi. Dengan Cloudflare Realtime TURN (keputusan K2),
 * kredensial dibuat per permintaan dan berumur pendek. Bila TURN tidak dikonfigurasi
 * atau gagal, jatuh ke STUN saja: preview mungkin gagal di CGNAT, tetapi foto tetap
 * diambil dari kamera lokal.
 */
export async function iceServers(): Promise<IceServer[]> {
  const turn = serverEnv().turn;
  if (!turn) return STUN_ONLY;

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turn.keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${turn.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { iceServers?: IceServer | IceServer[] };
    const servers = Array.isArray(body.iceServers)
      ? body.iceServers
      : body.iceServers
        ? [body.iceServers]
        : [];
    if (servers.length === 0) throw new Error("respons tanpa iceServers");
    return servers;
  } catch (err) {
    console.error("[turn] gagal membuat kredensial, memakai STUN saja", { message: (err as Error).message });
    return STUN_ONLY;
  }
}
