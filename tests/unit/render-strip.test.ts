import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SHOTS_PER_PERSON, type Role } from "@/domain/session-machine";
import { STRIP_SIZE, getTheme, stripSlots } from "@/domain/themes";
import { renderStrip } from "@/server/compose/render-strip";

const theme = getTheme("kangen-berat");
const COLORS: Record<Role, { r: number; g: number; b: number }> = {
  host: { r: 20, g: 120, b: 220 },
  guest: { r: 230, g: 160, b: 20 },
};

async function solidPhoto(role: Role, width = 1280, height = 720) {
  return sharp({ create: { width, height, channels: 3, background: COLORS[role] } })
    .webp()
    .toBuffer();
}

async function allPhotos() {
  const photos = [];
  for (const role of ["host", "guest"] as const) {
    for (let shotIndex = 0; shotIndex < SHOTS_PER_PERSON; shotIndex++) {
      photos.push({ role, shotIndex, buffer: await solidPhoto(role) });
    }
  }
  return photos;
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

describe("renderStrip", () => {
  it("menghasilkan PNG 600×1800", async () => {
    const png = await renderStrip(theme, await allPhotos());
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect({ width: meta.width, height: meta.height }).toEqual(STRIP_SIZE);
  });

  it("foto host di kolom kiri dan tamu di kolom kanan, di setiap baris", async () => {
    const png = await renderStrip(theme, await allPhotos());
    for (const slot of stripSlots(theme)) {
      const center = await pixel(
        png,
        Math.floor(slot.x + slot.width / 2),
        Math.floor(slot.y + slot.height / 2),
      );
      const expected = COLORS[slot.role];
      expect(Math.abs(center.r - expected.r)).toBeLessThan(12);
      expect(Math.abs(center.g - expected.g)).toBeLessThan(12);
      expect(Math.abs(center.b - expected.b)).toBeLessThan(12);
    }
  });

  it("menerima foto potret maupun lanskap (crop cover ke slot 3:4)", async () => {
    const photos = await allPhotos();
    photos[0].buffer = await solidPhoto("host", 720, 1280);
    await expect(renderStrip(theme, photos)).resolves.toBeInstanceOf(Buffer);
  });

  it("menolak bila foto tidak lengkap 8", async () => {
    const photos = (await allPhotos()).slice(1);
    await expect(renderStrip(theme, photos)).rejects.toThrow();
  });
});
