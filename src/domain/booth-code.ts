/**
 * Kode booth 6 karakter dari 32 simbol (~1 miliar kombinasi, PRD bagian keamanan).
 * Tanpa 0/1/I/O agar tidak tertukar saat dibaca atau diketik ulang.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

type RandomBytes = (length: number) => Uint8Array;

const cryptoRandomBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export function generateBoothCode(randomBytes: RandomBytes = cryptoRandomBytes): string {
  // 256 habis dibagi 32, jadi modulo tidak menimbulkan bias.
  return Array.from(randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Toleran terhadap huruf kecil, spasi, dan tanda hubung dari input manual. */
export const normalizeBoothCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, "");

export const isValidBoothCode = (code: string) => CODE_PATTERN.test(code);
