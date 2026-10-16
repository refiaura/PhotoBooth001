import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generateBoothCode, isValidBoothCode, normalizeBoothCode } from "@/domain/booth-code";

describe("kode booth", () => {
  it("alfabet 32 simbol tanpa 0, 1, I, O", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    for (const ch of "01IO") expect(CODE_ALPHABET).not.toContain(ch);
  });

  it("menghasilkan 6 karakter valid dari byte acak", () => {
    const code = generateBoothCode(() => new Uint8Array([0, 31, 32, 63, 200, 255]));
    // indeks 0, 31, 0, 31, 8, 31
    expect(code).toBe("2Z2ZAZ");
    expect(isValidBoothCode(code)).toBe(true);
  });

  it("tanpa bias: setiap byte dipetakan modulo 32 (256 habis dibagi 32)", () => {
    const counts = new Map<string, number>();
    for (let b = 0; b < 256; b++) {
      const ch = generateBoothCode(() => new Uint8Array(6).fill(b))[0];
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect([...counts.values()].every((n) => n === 8)).toBe(true);
  });

  it("memakai generator acak bawaan bila tidak diberi", () => {
    expect(isValidBoothCode(generateBoothCode())).toBe(true);
  });

  it.each([
    [" abc234 ", "ABC234"],
    ["abc-234", "ABC234"],
    ["ab c2 34", "ABC234"],
  ])("normalisasi %j → %s", (input, expected) => {
    expect(normalizeBoothCode(input)).toBe(expected);
  });

  it.each(["ABC23", "ABC2345", "ABC10O", "ABC23!", ""])("menolak %j", (code) => {
    expect(isValidBoothCode(code)).toBe(false);
  });
});
