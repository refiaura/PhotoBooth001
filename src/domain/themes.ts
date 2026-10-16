import { SHOTS_PER_PERSON, type Role } from "./session-machine";

/** Strip vertikal 2×6 inci pada 300 dpi. */
export const STRIP_SIZE = { width: 600, height: 1800 } as const;

export type ThemeColors = {
  /** Latar strip. */
  paper: string;
  /** Bingkai foto. */
  frame: string;
  /** Aksen dekorasi (hati, perangko). */
  accent: string;
  /** Aksen kedua. */
  accentSoft: string;
  /** Garis/tinta dekorasi. */
  ink: string;
};

export type StripLayout = {
  /** Jarak tepi kiri/kanan ke slot. */
  marginX: number;
  /** Tinggi area header di atas baris pertama. */
  top: number;
  /** Jarak antar kolom (host ↔ tamu). */
  gapX: number;
  /** Jarak antar baris. */
  gapY: number;
};

export type Theme = {
  id: string;
  name: string;
  colors: ThemeColors;
  strip: StripLayout;
};

export type Slot = {
  role: Role;
  shotIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Rasio slot foto: potret 3:4. */
const SLOT_ASPECT = 3 / 4;

/**
 * Definisi tema adalah sumber kebenaran layout (keputusan K7).
 * Tabel `themes` di database hanya menyimpan id + is_active sebagai feature flag.
 */
export const THEMES = {
  "kangen-berat": {
    id: "kangen-berat",
    name: "Kangen Berat",
    colors: {
      paper: "#FFF4E8",
      frame: "#FFFFFF",
      accent: "#E5486B",
      accentSoft: "#FFC2D1",
      ink: "#7A4A5A",
    },
    strip: { marginX: 30, top: 120, gapX: 20, gapY: 24 },
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME_ID: ThemeId = "kangen-berat";

export const isThemeId = (id: string): id is ThemeId => Object.hasOwn(THEMES, id);

export function getTheme(id: string): Theme {
  if (!isThemeId(id)) throw new Error(`Tema tidak dikenal: ${id}`);
  return THEMES[id];
}

/** Posisi 8 foto di strip: baris = nomor jepretan, kolom kiri = host, kanan = tamu. */
export function stripSlots(theme: Theme): Slot[] {
  const { marginX, top, gapX, gapY } = theme.strip;
  const width = Math.floor((STRIP_SIZE.width - 2 * marginX - gapX) / 2);
  const height = Math.round(width / SLOT_ASPECT);

  return Array.from({ length: SHOTS_PER_PERSON }, (_, shotIndex) => {
    const y = top + shotIndex * (height + gapY);
    return [
      { role: "host" as const, shotIndex, x: marginX, y, width, height },
      { role: "guest" as const, shotIndex, x: marginX + width + gapX, y, width, height },
    ];
  }).flat();
}
