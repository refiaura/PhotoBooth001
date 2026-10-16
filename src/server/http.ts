import "server-only";
import type { z } from "zod";

/** Error yang aman ditampilkan ke klien: kode stabil + status HTTP. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** Membungkus route handler: ApiError → JSON terstruktur, error lain → 500 tanpa detail. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.code }, err.status);
      console.error("[api] error tak terduga", err);
      return json({ error: "INTERNAL" }, 500);
    }
  };
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "BAD_JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "BAD_REQUEST");
  return parsed.data;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() || null : null;
}

/** IP klien di belakang proxy Vercel (dipakai hanya untuk rate limit). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
