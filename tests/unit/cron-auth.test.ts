import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/server/cron-auth";

const SECRET = "cron-secret-yang-panjang";

describe("isAuthorizedCron", () => {
  it("menerima header Bearer dengan secret yang benar", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    ["tanpa header", null],
    ["header kosong", ""],
    ["secret salah", "Bearer cron-secret-yang-salahh"],
    ["tanpa skema Bearer", SECRET],
    ["skema lain", `Basic ${SECRET}`],
    ["prefiks secret saja", `Bearer ${SECRET.slice(0, -1)}`],
    ["secret plus tambahan", `Bearer ${SECRET}x`],
  ])("menolak %s", (_label, header) => {
    expect(isAuthorizedCron(header, SECRET)).toBe(false);
  });
});
