import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Paket "server-only" sengaja melempar error di luar React Server Components;
      // di tes Node kita ganti dengan modul kosong.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/supabase-global-setup.ts"],
          testTimeout: 20_000,
          // Semua file berbagi satu database lokal.
          fileParallelism: false,
        },
      },
    ],
  },
});
