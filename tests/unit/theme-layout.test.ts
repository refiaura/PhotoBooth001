import { describe, expect, it } from "vitest";
import { SHOTS_PER_PERSON } from "@/domain/session-machine";
import { STRIP_SIZE, THEMES, getTheme, stripSlots } from "@/domain/themes";

type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("ukuran output", () => {
  it("strip 600×1800 px (2×6 inci pada 300 dpi)", () => {
    expect(STRIP_SIZE).toEqual({ width: 600, height: 1800 });
  });
});

describe.each(Object.keys(THEMES))("tema %s", (id) => {
  const theme = getTheme(id);
  const slots = stripSlots(theme);

  it("8 slot: 4 baris × (host kiri, tamu kanan)", () => {
    expect(slots).toHaveLength(SHOTS_PER_PERSON * 2);
    for (let shot = 0; shot < SHOTS_PER_PERSON; shot++) {
      const host = slots.find((s) => s.shotIndex === shot && s.role === "host")!;
      const guest = slots.find((s) => s.shotIndex === shot && s.role === "guest")!;
      expect(host.y).toBe(guest.y);
      expect(host.x).toBeLessThan(guest.x);
    }
  });

  it("baris berurutan dari atas ke bawah", () => {
    const ys = [0, 1, 2, 3].map((shot) => slots.find((s) => s.shotIndex === shot && s.role === "host")!.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("semua slot di dalam kanvas, berukuran bulat positif", () => {
    for (const s of slots) {
      for (const v of [s.x, s.y, s.width, s.height]) expect(Number.isInteger(v)).toBe(true);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      expect(s.x + s.width).toBeLessThanOrEqual(STRIP_SIZE.width);
      expect(s.y + s.height).toBeLessThanOrEqual(STRIP_SIZE.height);
    }
  });

  it("slot tidak saling tumpang tindih", () => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) expect(overlaps(slots[i], slots[j])).toBe(false);
    }
  });

  it("rasio slot 3:4 (potret) agar wajah tidak terpotong", () => {
    for (const s of slots) expect(s.width / s.height).toBeCloseTo(3 / 4, 1);
  });

  it("ada ruang header dan footer untuk dekorasi tema", () => {
    const top = Math.min(...slots.map((s) => s.y));
    const bottom = Math.max(...slots.map((s) => s.y + s.height));
    expect(top).toBeGreaterThanOrEqual(80);
    expect(STRIP_SIZE.height - bottom).toBeGreaterThanOrEqual(120);
  });
});

describe("getTheme", () => {
  it("melempar error untuk tema yang tidak dikenal", () => {
    expect(() => getTheme("tidak-ada")).toThrow();
  });

  it("tema Fase 1: kangen-berat", () => {
    expect(getTheme("kangen-berat").name).toBe("Kangen Berat");
  });
});
