"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { normalizeBoothCode } from "@/domain/booth-code";
import { Heart } from "@/components/heart";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { id } from "@/i18n/id";
import { SessionScreen } from "./session-screen";
import { useBooth, type BlockedReason } from "./use-booth";

const t = id.booth;

const BLOCKED_TEXT: Record<BlockedReason, string> = {
  "not-found": t.notFound,
  full: t.full,
  gone: t.gone,
  error: t.error,
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      {children}
    </main>
  );
}

export function BoothRoom() {
  const params = useParams<{ code: string }>();
  const code = normalizeBoothCode(params.code ?? "");
  const booth = useBooth(code);

  switch (booth.view.kind) {
    case "loading":
      return (
        <Centered>
          <Heart className="size-12" pulse />
          <p className="font-display text-xl" role="status">
            {t.loading}
          </p>
        </Centered>
      );

    case "blocked":
      return (
        <Centered>
          <Heart className="size-12 opacity-60" />
          <p className="font-display text-2xl leading-snug" role="alert">
            {BLOCKED_TEXT[booth.view.reason]}
          </p>
          {booth.view.reason === "error" ? (
            <button type="button" className={buttonPrimary} onClick={() => location.reload()}>
              {t.reload}
            </button>
          ) : (
            <Link href="/" className={buttonSecondary}>
              {t.backHome}
            </Link>
          )}
        </Centered>
      );

    case "join":
      return (
        <Centered>
          <Heart className="size-14" pulse />
          <h1 className="font-display text-3xl font-bold">{t.joinTitle}</h1>
          <p className="text-base leading-relaxed text-ink-soft">{t.joinBody}</p>
          <button type="button" className={buttonPrimary} onClick={booth.join} disabled={booth.joining}>
            {booth.joining ? t.joining : t.join}
          </button>
        </Centered>
      );

    case "session":
      return <SessionScreen booth={booth} code={code} />;
  }
}
