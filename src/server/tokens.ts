import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Token peserta acak 256-bit (PRD: "Orang lain mengambil alih sesi"). */
export const generateToken = () => randomBytes(32).toString("base64url");

/** Hash token dalam format bytea PostgREST ("\x<hex>"); token asli tidak pernah disimpan. */
export const tokenHashBytea = (token: string) => `\\x${sha256(token).toString("hex")}`;

/** Slug acak 22 karakter (128 bit) untuk link hasil. */
export const generateSlug = () => randomBytes(16).toString("base64url");

/** Perbandingan string rahasia tanpa membocorkan isi/panjang lewat waktu eksekusi. */
export const safeEqual = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));
