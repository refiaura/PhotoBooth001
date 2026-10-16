/** Jeda retry unggahan: 1, 2, 4 detik (PRD: "Pipeline Foto dan Penyimpanan"). */
export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Menjalankan `fn`, mencoba ulang hingga RETRY_DELAYS_MS.length kali bila gagal.
 * `shouldRetry` = false menghentikan retry (mis. 4xx yang pasti gagal lagi).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    shouldRetry?: (err: unknown) => boolean;
    onRetry?: (err: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const { shouldRetry = () => true, onRetry } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !shouldRetry(err)) throw err;
      onRetry?.(err, attempt + 1);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}
