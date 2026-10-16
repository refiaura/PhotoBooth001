import type { Role } from "@/domain/session-machine";
import type { PublicSession } from "@/server/booth-snapshot";

export type { PublicSession };

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export type SessionResponse = {
  role: Role;
  session: PublicSession;
  realtime: { channel: string; token: string };
  iceServers: IceServer[];
};

export type BoothInfo = { code: string; status: PublicSession["status"]; full: boolean; expiresAt: number };

/** Error dari API dengan kode stabil (mis. FULL, GONE, WRONG_ACCESS_CODE). */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }

  /** Error jaringan, 5xx, dan 429 layak dicoba ulang; 4xx lain tidak. */
  get retryable() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

async function request<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "NETWORK");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiClientError(res.status, data.error ?? "UNKNOWN");
  return data as T;
}

const boothPath = (code: string, suffix = "") => `/api/booths/${encodeURIComponent(code)}${suffix}`;

export const api = {
  serverTime: () => request<{ now: number }>("/api/time"),

  createBooth: (accessCode: string) =>
    request<{ code: string; token: string; inviteUrl: string }>("/api/booths", { body: { accessCode } }),

  boothInfo: (code: string) => request<BoothInfo>(boothPath(code)),

  join: (code: string, token?: string) =>
    request<{ token: string; role: Role; session: PublicSession }>(boothPath(code, "/join"), {
      body: token ? { token } : {},
    }),

  session: (code: string, token: string) => request<SessionResponse>(boothPath(code, "/session"), { token }),

  setReady: (code: string, token: string, ready: boolean) =>
    request<{ session: PublicSession }>(boothPath(code, "/ready"), { token, body: { ready } }),

  /** Menandai jepretan sudah diambil + meminta signed upload URL. */
  shotCaptured: (code: string, token: string, shotIndex: number, mimeType: string) =>
    request<{ photoId: string; path: string; token: string }>(boothPath(code, "/photos/upload-url"), {
      token,
      body: { shotIndex, mimeType },
    }),

  confirmPhoto: (code: string, token: string, photoId: string) =>
    request<{ session: PublicSession }>(boothPath(code, "/photos"), { token, body: { photoId } }),

  composeStrip: (code: string, token: string) =>
    request<{ session: PublicSession }>(boothPath(code, "/strips"), { token, method: "POST" }),

  strip: (slug: string) =>
    request<{ strip: { url: string; downloadUrl: string }; createdAt: number; expiresAt: number }>(
      `/api/strips/${encodeURIComponent(slug)}`,
    ),
};
