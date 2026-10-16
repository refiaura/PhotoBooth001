import { defineConfig, devices } from "@playwright/test";

// Nilai lokal (mis. ACCESS_CODE) dibaca dari .env.local yang juga dipakai `next dev`.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Tanpa .env.local, tes yang butuh kode akses akan di-skip.
}

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Alur dua peserta berbagi satu booth; jalankan berurutan agar tidak saling ganggu.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // `next dev` mengompilasi route saat pertama dibuka; beri waktu lebih.
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    permissions: ["camera"],
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          // Kamera palsu: Chromium menghasilkan pola video uji, tanpa dialog izin.
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
