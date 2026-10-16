import { beforeAll, describe, expect, inject, it } from "vitest";
import { useLocalServerEnv } from "../support/server-env";

const CRON_SECRET = "cron-secret-untuk-tes-integrasi";
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  useLocalServerEnv(inject("supabase"), { CRON_SECRET });
  ({ GET } = await import("@/app/api/cron/daily/route"));
});

const request = (auth?: string) =>
  new Request("http://localhost/api/cron/daily", {
    headers: auth ? { authorization: auth } : {},
  });

describe("GET /api/cron/daily", () => {
  it("menolak tanpa CRON_SECRET (401)", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("menolak secret yang salah (401)", async () => {
    const res = await GET(request("Bearer salah"));
    expect(res.status).toBe(401);
  });

  it("dengan secret benar, melakukan ping ke database", async () => {
    const res = await GET(request(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, database: "ok" });
  });
});
