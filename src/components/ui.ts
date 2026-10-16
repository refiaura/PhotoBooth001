/** Kelas tombol bersama. Fredoka di tombol agar terasa "membulat", target sentuh ≥ 48 px. */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-display text-lg font-semibold " +
  "transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary = `${base} bg-heart text-heart-ink shadow-[0_4px_0_0_rgb(0_0_0/0.18)]`;
export const buttonSecondary = `${base} border-2 border-ink/80 bg-surface text-ink`;
export const buttonQuiet = `${base} text-ink underline decoration-2 underline-offset-4 px-2`;
