import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

export type LocalSupabase = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

/** Membaca kredensial Supabase LOKAL dari `supabase status -o env`. */
function readLocalSupabase(): LocalSupabase {
  let output: string;
  try {
    output = execSync("pnpm exec supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "Supabase lokal belum berjalan. Jalankan `pnpm db:start` (butuh Docker) sebelum `pnpm test:integration`.",
    );
  }

  const vars = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );

  const url = vars.API_URL;
  const anonKey = vars.ANON_KEY;
  const serviceRoleKey = vars.SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Output `supabase status` tidak berisi API_URL/ANON_KEY/SERVICE_ROLE_KEY.");
  }

  // Pengaman: tes integrasi menghapus data, jadi tolak apa pun selain localhost.
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Tes integrasi hanya boleh berjalan ke Supabase lokal, bukan ${host}.`);
  }

  return { url, anonKey, serviceRoleKey };
}

export default function setup(project: TestProject): void {
  project.provide("supabase", readLocalSupabase());
}
