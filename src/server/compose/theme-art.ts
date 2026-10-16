import { STRIP_SIZE, type Slot, type Theme } from "@/domain/themes";

/**
 * Hiasan tema dalam SVG murni (tanpa teks/font), dirender oleh sharp/librsvg.
 * Teks caption dan tanggal menyusul di Fase 2 bersama font yang di-bundle.
 */

const { width: W, height: H } = STRIP_SIZE;

/** Hati dengan kotak pembatas (x, y, size×size). */
function heart(x: number, y: number, size: number, fill: string, extra = "") {
  return (
    `<path transform="translate(${x} ${y}) scale(${size})" fill="${fill}" ${extra} ` +
    `d="M0.5 0.95 C0.5 0.95 0 0.62 0 0.3 C0 0.12 0.14 0 0.29 0 C0.4 0 0.47 0.07 0.5 0.15 ` +
    `C0.53 0.07 0.6 0 0.71 0 C0.86 0 1 0.12 1 0.3 C1 0.62 0.5 0.95 0.5 0.95 Z"/>`
  );
}

/** Amplop kecil dengan perangko hati. */
function envelope(x: number, y: number, w: number, h: number, c: Theme["colors"]) {
  const stamp = Math.round(h * 0.42);
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect x="3" y="4" width="${w}" height="${h}" rx="8" fill="${c.accentSoft}" opacity="0.55"/>`,
    `<rect width="${w}" height="${h}" rx="8" fill="${c.frame}" stroke="${c.ink}" stroke-width="3"/>`,
    `<path d="M4 6 L${w / 2} ${h * 0.58} L${w - 4} 6" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/>`,
    `<rect x="${w - stamp - 8}" y="8" width="${stamp}" height="${stamp}" rx="3" fill="${c.paper}" stroke="${c.accent}" stroke-width="2" stroke-dasharray="3 2"/>`,
    heart(w - stamp - 8 + stamp * 0.2, 8 + stamp * 0.22, stamp * 0.6, c.accent),
    `</g>`,
  ].join("");
}

/** Pesawat kertas kecil yang menghadap kanan. */
function plane(x: number, y: number, c: Theme["colors"]) {
  return (
    `<g transform="translate(${x} ${y}) rotate(-12)">` +
    `<path d="M0 10 L34 0 L22 22 L16 14 Z" fill="${c.frame}" stroke="${c.ink}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M16 14 L34 0" stroke="${c.ink}" stroke-width="2"/></g>`
  );
}

export function themeArt(theme: Theme, slots: Slot[]): { background: string; overlay: string } {
  const c = theme.colors;
  const lastBottom = Math.max(...slots.map((s) => s.y + s.height));
  const footerMid = (lastBottom + H) / 2;
  const frames = slots
    .map(
      (s) =>
        `<rect x="${s.x - 8 + 4}" y="${s.y - 8 + 6}" width="${s.width + 16}" height="${s.height + 16}" rx="20" fill="${c.accentSoft}" opacity="0.6"/>` +
        `<rect x="${s.x - 8}" y="${s.y - 8}" width="${s.width + 16}" height="${s.height + 16}" rx="20" fill="${c.frame}"/>`,
    )
    .join("");

  const background = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse">`,
    `<circle cx="6" cy="6" r="2.4" fill="${c.accentSoft}" opacity="0.7"/>`,
    `<circle cx="24" cy="24" r="1.6" fill="${c.accentSoft}" opacity="0.5"/></pattern></defs>`,
    `<rect width="${W}" height="${H}" fill="${c.paper}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#dots)"/>`,
    // Header: dua amplop dari dua kota, dihubungkan rute pesawat.
    envelope(34, 26, 96, 64, c),
    envelope(W - 34 - 96, 26, 96, 64, c),
    `<path d="M140 62 C 220 4, 380 4, 460 62" fill="none" stroke="${c.ink}" stroke-width="3" stroke-dasharray="9 9" stroke-linecap="round"/>`,
    plane(282, 14, c),
    frames,
    // Footer: hati besar di tengah rute putus-putus.
    `<path d="M60 ${footerMid} H ${W / 2 - 70} M ${W / 2 + 70} ${footerMid} H ${W - 60}" stroke="${c.ink}" stroke-width="3" stroke-dasharray="9 9" stroke-linecap="round"/>`,
    heart(W / 2 - 56, footerMid - 54, 112, c.accent),
    heart(W / 2 - 22, footerMid - 26, 44, c.accentSoft, `opacity="0.65"`),
    heart(40, footerMid - 46, 30, c.accentSoft),
    heart(W - 70, footerMid + 18, 30, c.accentSoft),
    `</svg>`,
  ].join("");

  // Hati kecil di antara pasangan foto, di atas bingkai.
  const rowHearts = slots
    .filter((s) => s.role === "host")
    .map((s) =>
      heart(s.x + s.width - 6 + (W / 2 - (s.x + s.width)) - 13, s.y + s.height / 2 - 13, 26, c.accent),
    )
    .join("");
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rowHearts}</svg>`;

  return { background, overlay };
}
