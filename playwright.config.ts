import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Alur dua peserta berbagi satu booth; jalankan berurutan agar tidak saling ganggu.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
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
