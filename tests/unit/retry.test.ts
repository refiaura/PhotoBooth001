import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RETRY_DELAYS_MS, withRetry } from "@/lib/retry";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withRetry", () => {
  it("jeda bertahap 1, 2, 4 detik (PRD)", () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
  });

  it("berhasil tanpa retry", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("mencoba ulang hingga 3 kali dengan jeda 1, 2, 4 detik", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"))
      .mockRejectedValueOnce(new Error("c"))
      .mockResolvedValue("akhirnya");
    const onRetry = vi.fn();
    const promise = withRetry(fn, { onRetry });

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(promise).resolves.toBe("akhirnya");
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it("menyerah setelah 3 kali retry dan melempar error terakhir", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("tetap gagal"));
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow("tetap gagal");
    await vi.advanceTimersByTimeAsync(7000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("tidak mencoba ulang error yang tidak bisa dipulihkan", async () => {
    const fatal = Object.assign(new Error("ditolak"), { retryable: false });
    const fn = vi.fn().mockRejectedValue(fatal);
    await expect(
      withRetry(fn, { shouldRetry: (e) => (e as { retryable?: boolean }).retryable !== false }),
    ).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
