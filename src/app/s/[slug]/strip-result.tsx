"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { Heart } from "@/components/heart";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { id } from "@/i18n/id";

const t = id.result;

type Loaded = Awaited<ReturnType<typeof api.strip>>;
type State = { kind: "loading" } | { kind: "missing" } | { kind: "ok"; data: Loaded };

export function StripResult() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .strip(slug)
      .then((data) => !cancelled && setState({ kind: "ok", data }))
      .catch(() => !cancelled && setState({ kind: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-5 py-10 text-center">
      <Link href="/" className="font-display text-2xl font-bold">
        {id.appName}
      </Link>

      {state.kind === "loading" && (
        <div className="flex flex-col items-center gap-3" role="status">
          <Heart className="size-12" pulse />
          <p className="font-display text-xl">{t.loading}</p>
        </div>
      )}

      {state.kind === "missing" && (
        <>
          <p className="font-display text-2xl leading-snug" role="alert">
            {t.notFound}
          </p>
          <Link href="/" className={buttonSecondary}>
            {t.newSession}
          </Link>
        </>
      )}

      {state.kind === "ok" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Storage, bukan aset statis */}
          <img
            src={state.data.strip.url}
            alt={id.booth.stripAlt}
            width={600}
            height={1800}
            className="w-56 rounded-xl shadow-[0_8px_0_0_var(--strawberry)]"
          />
          <a href={state.data.strip.downloadUrl} className={`${buttonPrimary} w-full`} download>
            {id.booth.download}
          </a>
          <p className="text-sm text-ink-soft">
            {t.expiresOn(
              new Date(state.data.expiresAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            )}
          </p>
          <Link href="/" className={buttonSecondary}>
            {t.newSession}
          </Link>
        </>
      )}
    </main>
  );
}
