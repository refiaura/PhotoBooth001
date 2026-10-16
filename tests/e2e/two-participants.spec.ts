import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

/** Target PRD: selisih momen jepret antarperangkat ≤ 300 ms. */
const MAX_SKEW_MS = 300;

const accessCode = process.env.ACCESS_CODE;

type Capture = { role: string; shotIndex: number; at: number };

async function newParticipant(browser: Browser, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext({ ...options, permissions: ["camera"] });
  // Kait tes: klien mencatat momen jepret ke array ini bila tersedia.
  await context.addInitScript(() => {
    window.__rinduCaptures = [];
  });
  return context.newPage();
}

const captures = (page: Page) => page.evaluate(() => window.__rinduCaptures ?? []) as Promise<Capture[]>;

test.describe("alur dua peserta", () => {
  test.skip(!accessCode, "ACCESS_CODE belum diisi di .env.local");
  test.setTimeout(120_000);

  test("buat booth → tamu join → siap → 4 jepretan sinkron → photostrip", async ({ browser }, testInfo) => {
    const options = testInfo.project.use as BrowserContextOptions;
    const host = await newParticipant(browser, options);
    const guest = await newParticipant(browser, options);

    // Host membuat booth dengan kode akses.
    await host.goto("/");
    await host.getByLabel("Kode akses").fill(accessCode!);
    await host.getByRole("button", { name: "Buat booth" }).click();
    await expect(host).toHaveURL(/\/b\/[23456789A-Z]{6}$/);
    const inviteLink = (await host.getByTestId("invite-link").textContent())!.trim();
    await host.getByRole("button", { name: "Nyalakan kamera" }).click();

    // Tamu membuka link undangan, tanpa akun.
    await guest.goto(new URL(inviteLink).pathname);
    await guest.getByRole("button", { name: "Masuk booth" }).click();
    await guest.getByRole("button", { name: "Nyalakan kamera" }).click();

    await expect(host.getByText("Pasanganmu sudah masuk, rapikan poni dulu!")).toBeVisible();

    // Preview pasangan lewat WebRTC menerima frame video.
    for (const page of [host, guest]) {
      await expect
        .poll(() => page.getByTestId("partner-video").evaluate((v: HTMLVideoElement) => v.videoWidth), {
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
    }

    // Orang ketiga ditolak.
    const stranger = await newParticipant(browser, options);
    await stranger.goto(new URL(inviteLink).pathname);
    await expect(stranger.getByText("Booth ini sudah penuh. Isinya cuma muat berdua.")).toBeVisible();

    await host.getByRole("button", { name: "Siap!" }).click();
    await guest.getByRole("button", { name: "Siap!" }).click();

    // 4 jepretan + komposisi.
    for (const page of [host, guest]) {
      await expect(page.getByTestId("strip-image")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Unduh PNG" })).toHaveAttribute("href", /download=/);
    }

    // Sinkronisasi: kedua peserta menjepret di momen yang (hampir) sama untuk tiap shot.
    const [hostShots, guestShots] = await Promise.all([captures(host), captures(guest)]);
    expect(hostShots.map((c) => c.shotIndex)).toEqual([0, 1, 2, 3]);
    expect(guestShots.map((c) => c.shotIndex)).toEqual([0, 1, 2, 3]);
    const skews = hostShots.map((h, i) => Math.abs(h.at - guestShots[i].at));
    testInfo.annotations.push({ type: "selisih jepret (ms)", description: skews.join(", ") });
    console.log(`selisih jepret (ms): ${skews.join(", ")}`);
    for (const skew of skews) expect(skew).toBeLessThanOrEqual(MAX_SKEW_MS);

    // Kamera dimatikan setelah sesi selesai.
    for (const page of [host, guest]) {
      await expect
        .poll(() => page.getByTestId("self-video").evaluate((v: HTMLVideoElement) => v.srcObject === null))
        .toBe(true);
    }

    // Halaman hasil bisa dibuka dari link.
    await host.getByRole("link", { name: "Buka halaman hasil" }).click();
    await expect(host).toHaveURL(/\/s\/[A-Za-z0-9_-]{22}$/);
    await expect(host.getByRole("img", { name: /Photostrip/ })).toBeVisible();
  });

  test("reload di tengah unggahan: foto pengganti diambil, sesi tetap selesai", async ({
    browser,
  }, testInfo) => {
    const options = testInfo.project.use as BrowserContextOptions;
    const host = await newParticipant(browser, options);
    const guest = await newParticipant(browser, options);

    await host.goto("/");
    await host.getByLabel("Kode akses").fill(accessCode!);
    await host.getByRole("button", { name: "Buat booth" }).click();
    await expect(host).toHaveURL(/\/b\/[23456789A-Z]{6}$/);
    const boothPath = new URL(host.url()).pathname;
    await host.getByRole("button", { name: "Nyalakan kamera" }).click();

    await guest.goto(boothPath);
    await guest.getByRole("button", { name: "Masuk booth" }).click();
    await guest.getByRole("button", { name: "Nyalakan kamera" }).click();

    // Konfirmasi unggahan host gagal terus (mis. sinyal hilang), jadi foto tertahan di memori.
    await host.route("**/api/booths/*/photos", (route) => route.abort());
    await host.getByRole("button", { name: "Siap!" }).click();
    await guest.getByRole("button", { name: "Siap!" }).click();
    await expect(guest.getByText("Lagi nyusun photostrip kalian...")).toBeVisible({ timeout: 60_000 });

    // Host me-reload: foto di memori hilang, server masih menunggu 4 foto host.
    await host.unroute("**/api/booths/*/photos");
    await host.reload();
    await expect(host.getByText(/Ada foto kamu yang belum terkirim/)).toBeVisible();
    await host.getByRole("button", { name: "Nyalakan kamera" }).click();

    for (const page of [host, guest]) {
      await expect(page.getByTestId("strip-image")).toBeVisible({ timeout: 60_000 });
    }
  });
});
