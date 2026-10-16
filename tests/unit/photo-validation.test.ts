import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, sniffImageType, validatePhoto } from "@/server/photo-validation";

const image = (format: "webp" | "jpeg" | "png", width = 1280, height = 720) =>
  sharp({ create: { width, height, channels: 3, background: "#ff99aa" } })
    .toFormat(format)
    .toBuffer();

describe("sniffImageType (dari isi file, bukan ekstensi)", () => {
  it("mengenali WebP dan JPEG", async () => {
    expect(sniffImageType(await image("webp"))).toBe("image/webp");
    expect(sniffImageType(await image("jpeg"))).toBe("image/jpeg");
  });

  it("menolak PNG, teks, dan file kosong", async () => {
    expect(sniffImageType(await image("png"))).toBeNull();
    expect(sniffImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("validatePhoto", () => {
  it("mengembalikan tipe, dimensi, dan ukuran", async () => {
    const buf = await image("webp", 1280, 720);
    await expect(validatePhoto(buf)).resolves.toEqual({
      ok: true,
      meta: { mimeType: "image/webp", width: 1280, height: 720, sizeBytes: buf.length },
    });
  });

  it("menolak file di atas 5 MB", async () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
    const big = Buffer.concat([await image("jpeg"), Buffer.alloc(MAX_PHOTO_BYTES)]);
    await expect(validatePhoto(big)).resolves.toEqual({ ok: false, reason: "TOO_LARGE" });
  });

  it("menolak tipe yang tidak didukung", async () => {
    await expect(validatePhoto(await image("png"))).resolves.toEqual({ ok: false, reason: "BAD_TYPE" });
  });

  it("menolak gambar terlalu kecil", async () => {
    await expect(validatePhoto(await image("jpeg", 100, 80))).resolves.toEqual({
      ok: false,
      reason: "BAD_DIMENSIONS",
    });
  });

  it("menolak header JPEG palsu dengan isi rusak", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("bukan gambar")]);
    await expect(validatePhoto(fake)).resolves.toEqual({ ok: false, reason: "CORRUPT" });
  });
});
