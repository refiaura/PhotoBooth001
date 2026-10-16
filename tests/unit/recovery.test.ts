import { describe, expect, it } from "vitest";
import { orphanedShots } from "@/domain/recovery";
import type { ShotSlot } from "@/domain/session-machine";

const slot = (captured: boolean, uploaded: boolean): ShotSlot => ({ captured, uploaded });

describe("orphanedShots (foto tercatat dijepret tapi tidak ada lagi di perangkat)", () => {
  it("kosong bila semua foto sudah terunggah atau belum dijepret", () => {
    expect(
      orphanedShots("COMPOSING", [slot(true, true), slot(true, true), slot(false, false)], new Set()),
    ).toEqual([]);
  });

  it("menemukan shot yang dijepret tapi belum terunggah dan tidak sedang diproses (mis. setelah reload)", () => {
    const slots = [slot(true, true), slot(true, false), slot(true, false), slot(false, false)];
    expect(orphanedShots("COMPOSING", slots, new Set())).toEqual([1, 2]);
  });

  it("mengabaikan shot yang masih diproses/di memori perangkat ini", () => {
    const slots = [slot(true, false), slot(true, false)];
    expect(orphanedShots("CAPTURING", slots, new Set([0]))).toEqual([1]);
  });

  it.each(["WAITING_READY", "REVIEW", "DONE", "EXPIRED", "PAUSED"] as const)(
    "tidak ada pemulihan di status %s",
    (status) => {
      expect(orphanedShots(status, [slot(true, false)], new Set())).toEqual([]);
    },
  );
});
