import { isAuthorizedCron } from "@/server/cron-auth";
import { serverEnv } from "@/server/env";
import { supabaseAdmin } from "@/server/supabase-admin";

/**
 * Dipanggil Vercel Cron sekali sehari (lihat vercel.json).
 * Fase 0: hanya ping database agar proyek Supabase gratis tidak dijeda.
 * Fase 2: ditambah pembersihan foto/strip/booth yang kedaluwarsa.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin().from("themes").select("id").limit(1);
  if (error) {
    console.error("[cron/daily] ping database gagal", { code: error.code });
    return Response.json({ ok: false, database: "error" }, { status: 503 });
  }

  return Response.json({ ok: true, database: "ok" });
}
