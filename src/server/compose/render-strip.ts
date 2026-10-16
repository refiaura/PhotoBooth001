import sharp from "sharp";
import { SHOTS_PER_PERSON, type Role } from "@/domain/session-machine";
import { STRIP_SIZE, stripSlots, type Slot, type Theme } from "@/domain/themes";
import { themeArt } from "./theme-art";

export type StripPhoto = { role: Role; shotIndex: number; buffer: Buffer };

const PHOTO_RADIUS = 14;

function roundedMask(width: number, height: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" rx="${PHOTO_RADIUS}" ry="${PHOTO_RADIUS}"/></svg>`,
  );
}

/** Crop "cover" ke rasio slot (wajah di tengah tetap utuh), sudut membulat. */
async function fitToSlot(buffer: Buffer, slot: Slot) {
  return sharp(buffer)
    .rotate()
    .resize(slot.width, slot.height, { fit: "cover", position: "centre" })
    .composite([{ input: roundedMask(slot.width, slot.height), blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Menyusun photostrip PNG 600×1800: latar tema → 8 foto → hiasan di atas foto.
 * Dijalankan di server agar hasil identik di kedua perangkat (PRD F4).
 */
export async function renderStrip(theme: Theme, photos: StripPhoto[]): Promise<Buffer> {
  const slots = stripSlots(theme);
  const byKey = new Map(photos.map((p) => [`${p.role}:${p.shotIndex}`, p]));
  if (byKey.size !== SHOTS_PER_PERSON * 2 || slots.some((s) => !byKey.has(`${s.role}:${s.shotIndex}`))) {
    throw new Error(`renderStrip: butuh ${SHOTS_PER_PERSON * 2} foto unik, dapat ${byKey.size}`);
  }

  const art = themeArt(theme, slots);
  const placed = await Promise.all(
    slots.map(async (slot) => ({
      input: await fitToSlot(byKey.get(`${slot.role}:${slot.shotIndex}`)!.buffer, slot),
      left: slot.x,
      top: slot.y,
    })),
  );

  return sharp(Buffer.from(art.background))
    .resize(STRIP_SIZE.width, STRIP_SIZE.height)
    .composite([...placed, { input: Buffer.from(art.overlay), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
