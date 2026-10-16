"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError, api } from "@/client/api";
import { saveToken } from "@/client/token-store";
import { buttonPrimary } from "@/components/ui";
import { id } from "@/i18n/id";

const t = id.landing;

export function CreateBoothForm() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const booth = await api.createBooth(accessCode.trim());
      saveToken(booth.code, booth.token);
      router.push(`/b/${booth.code}`);
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "";
      setError(
        code === "WRONG_ACCESS_CODE" ? t.wrongCode : code === "RATE_LIMITED" ? t.rateLimited : t.genericError,
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="access-code" className="font-display text-lg font-semibold">
        {t.accessCodeLabel}
      </label>
      <input
        id="access-code"
        name="access-code"
        type="password"
        autoComplete="off"
        required
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
        aria-describedby="access-code-hint access-code-error"
        aria-invalid={error ? true : undefined}
        className="min-h-12 rounded-2xl border-2 border-line bg-surface px-4 text-lg text-ink outline-none focus-visible:border-heart"
      />
      <p id="access-code-hint" className="text-sm text-ink-soft">
        {t.accessCodeHint}
      </p>
      <p id="access-code-error" role="alert" className="min-h-6 text-sm font-semibold text-heart">
        {error}
      </p>
      <button type="submit" className={buttonPrimary} disabled={busy || accessCode.trim() === ""}>
        {busy ? t.creating : t.create}
      </button>
    </form>
  );
}
