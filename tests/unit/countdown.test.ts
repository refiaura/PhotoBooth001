import { describe, expect, it } from "vitest";
import { countdownPhase } from "@/domain/countdown";

describe("countdownPhase (tampilan 3-2-1 dari sisa waktu ke fireAt lokal)", () => {
  it.each([
    [3400, { kind: "get-ready" }],
    [3000, { kind: "count", value: 3 }],
    [2001, { kind: "count", value: 3 }],
    [2000, { kind: "count", value: 2 }],
    [1000, { kind: "count", value: 1 }],
    [1, { kind: "count", value: 1 }],
    [0, { kind: "snap" }],
    [-500, { kind: "snap" }],
    [-801, { kind: "done" }],
  ])("%i ms → %o", (remaining, expected) => {
    expect(countdownPhase(remaining)).toEqual(expected);
  });
});
