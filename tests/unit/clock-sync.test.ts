import { describe, expect, it } from "vitest";
import { PING_COUNT, estimateOffset, offsetFromSample, serverToLocal } from "@/domain/clock-sync";

describe("offsetFromSample", () => {
  it("offset = serverTime - (t0 + t1) / 2", () => {
    // Jam klien 1000 ms di belakang server, RTT 200 ms simetris.
    expect(offsetFromSample({ t0: 10_000, serverTime: 11_100, t1: 10_200 })).toBe(1000);
  });

  it("offset negatif bila jam klien lebih cepat", () => {
    expect(offsetFromSample({ t0: 5000, serverTime: 4550, t1: 5100 })).toBe(-500);
  });
});

describe("estimateOffset", () => {
  it("memakai 5 ping", () => {
    expect(PING_COUNT).toBe(5);
  });

  it("memakai median, tahan terhadap satu ping lambat", () => {
    const samples = [
      { t0: 0, serverTime: 1050, t1: 100 }, // 1000
      { t0: 0, serverTime: 1060, t1: 100 }, // 1010
      { t0: 0, serverTime: 1040, t1: 100 }, // 990
      { t0: 0, serverTime: 3000, t1: 2000 }, // 2000 (outlier, RTT besar)
      { t0: 0, serverTime: 1055, t1: 100 }, // 1005
    ];
    expect(estimateOffset(samples)).toBe(1005);
  });

  it("median dari jumlah genap = rata-rata dua nilai tengah", () => {
    const samples = [10, 20, 30, 40].map((o) => ({ t0: 0, serverTime: o, t1: 0 }));
    expect(estimateOffset(samples)).toBe(25);
  });

  it("menolak daftar kosong", () => {
    expect(() => estimateOffset([])).toThrow();
  });
});

describe("serverToLocal", () => {
  it("fireAt (jam server) dikonversi ke jam lokal: fireAt - offset", () => {
    expect(serverToLocal(50_000, 1000)).toBe(49_000);
    expect(serverToLocal(50_000, -250)).toBe(50_250);
  });

  it("dua klien dengan jam berbeda menjepret di momen nyata yang sama", () => {
    const fireAt = 1_000_000;
    // Klien A 3 detik di depan server (offset -3000), klien B 2 detik di belakang (offset +2000).
    const localA = serverToLocal(fireAt, -3000);
    const localB = serverToLocal(fireAt, 2000);
    // Ubah kembali ke "waktu nyata" (jam server) dari jam masing-masing.
    expect(localA - 3000).toBe(localB + 2000);
  });
});
