import { connection } from "next/server";

/** Jam server untuk kalibrasi offset klien (5 ping, median). */
export async function GET(): Promise<Response> {
  // Tanpa ini, Cache Components akan me-prerender respons statis saat build.
  await connection();
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
