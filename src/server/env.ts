import "server-only";
import { z } from "zod";

// String kosong ("FOO=") diperlakukan sama dengan tidak diisi.
const blankToUndefined = (v: unknown) => (v === "" ? undefined : v);
const required = (min = 1) => z.preprocess(blankToUndefined, z.string().min(min));
const optional = () => z.preprocess(blankToUndefined, z.string().min(1).optional());

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankToUndefined, z.url()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required(20),
    SUPABASE_SERVICE_ROLE_KEY: required(20),
    // Untuk menandatangani JWT pendek kanal Realtime privat (keputusan K1).
    SUPABASE_JWT_SECRET: required(32),
    ACCESS_CODE: required(8),
    // Cloudflare Realtime TURN (keputusan K2). Opsional: tanpa TURN hanya STUN publik.
    TURN_KEY_ID: optional(),
    TURN_KEY_API_TOKEN: optional(),
    CRON_SECRET: required(16),
  })
  .superRefine((env, ctx) => {
    const hasId = env.TURN_KEY_ID !== undefined;
    const hasToken = env.TURN_KEY_API_TOKEN !== undefined;
    if (hasId !== hasToken) {
      ctx.addIssue({
        code: "custom",
        path: [hasId ? "TURN_KEY_API_TOKEN" : "TURN_KEY_ID"],
        message: "TURN_KEY_ID dan TURN_KEY_API_TOKEN harus diisi berdua atau dikosongkan berdua",
      });
    }
  })
  .transform(({ TURN_KEY_ID, TURN_KEY_API_TOKEN, ...rest }) => ({
    ...rest,
    turn: TURN_KEY_ID && TURN_KEY_API_TOKEN ? { keyId: TURN_KEY_ID, apiToken: TURN_KEY_API_TOKEN } : null,
  }));

export type ServerEnv = z.infer<typeof schema>;

/**
 * Memvalidasi environment server. Pesan error hanya menyebut NAMA variabel,
 * tidak pernah nilainya, agar secret tidak bocor ke log.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Konfigurasi environment tidak valid:\n${lines.join("\n")}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Env server tervalidasi (di-cache). Dipanggil saat request, bukan saat build. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
