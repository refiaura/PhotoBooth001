import { expect, test } from "@playwright/test";

test("halaman utama tampil dalam Bahasa Indonesia", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Rindu Berat/);
  await expect(page.getByRole("heading", { level: 1, name: "Rindu Berat" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});

test("kamera palsu tersedia untuk tes E2E berikutnya", async ({ page }) => {
  await page.goto("/");
  const tracks = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const count = stream.getVideoTracks().length;
    stream.getTracks().forEach((t) => t.stop());
    return count;
  });
  expect(tracks).toBe(1);
});
