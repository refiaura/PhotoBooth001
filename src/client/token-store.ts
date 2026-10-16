/**
 * Token peserta disimpan di perangkat agar refresh halaman tidak dianggap peserta baru (PRD).
 * localStorage bisa tidak tersedia (mode privat, dll.), jadi semua akses dibungkus try/catch.
 */
const key = (code: string) => `rindu-berat:token:${code}`;

export function loadToken(code: string): string | null {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function saveToken(code: string, token: string): void {
  try {
    localStorage.setItem(key(code), token);
  } catch {
    // Tanpa penyimpanan, sesi tetap jalan; hanya refresh yang akan meminta join ulang.
  }
}
