"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { serverToLocal } from "@/domain/clock-sync";
import { countdownPhase, type CountdownPhase } from "@/domain/countdown";
import { SHOTS_PER_PERSON, type Role } from "@/domain/session-machine";
import { Confetti } from "@/components/confetti";
import { Heart } from "@/components/heart";
import { RouteLine } from "@/components/route-line";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui";
import { id } from "@/i18n/id";
import type { BoothState } from "./use-booth";

const t = id.booth;

/** Status yang masih butuh kamera menyala. */
const NEEDS_CAMERA = new Set(["WAITING_GUEST", "WAITING_READY", "CAPTURING", "PAUSED"]);

const CAMERA_ERROR_TEXT = {
  denied: t.cameraDenied,
  "not-found": t.cameraNotFound,
  busy: t.cameraBusy,
  unsupported: t.cameraUnsupported,
  unknown: t.cameraDenied,
} as const;

function VideoWindow(props: {
  label: string;
  tint: string;
  stream: MediaStream | null;
  mirrored?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  placeholder: React.ReactNode;
  testId: string;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const { stream, videoRef } = props;

  useEffect(() => {
    const el = localRef.current;
    if (videoRef) videoRef.current = el;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream, videoRef]);

  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-3xl border-[6px] border-surface ${props.tint} shadow-[0_6px_0_0_var(--strawberry)]`}
    >
      <video
        ref={localRef}
        data-testid={props.testId}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 size-full object-cover ${props.mirrored ? "-scale-x-100" : ""} ${stream ? "" : "hidden"}`}
      />
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm leading-snug text-ink">
          {props.placeholder}
        </div>
      )}
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-0.5 font-display text-base font-semibold text-ink">
        {props.label}
      </span>
    </div>
  );
}

function Countdown({ localFireAt }: { localFireAt: number }) {
  const [phase, setPhase] = useState<CountdownPhase>({ kind: "get-ready" });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = countdownPhase(localFireAt - Date.now());
      setPhase((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      if (next.kind !== "done") raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [localFireAt]);

  if (phase.kind === "done") return null;
  return (
    <>
      {phase.kind === "snap" && (
        <div className="fixed inset-0 z-40 animate-snap-flash bg-white" aria-hidden />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
        aria-live="assertive"
      >
        {phase.kind === "count" ? (
          <span
            key={phase.value}
            className="animate-count-pop font-display text-[9rem] leading-none font-bold text-white [text-shadow:0_6px_0_var(--heart),0_0_24px_rgb(0_0_0/0.35)]"
          >
            {phase.value}
          </span>
        ) : (
          <span className="rounded-full bg-surface/95 px-5 py-2 font-display text-2xl font-semibold text-ink">
            {phase.kind === "snap" ? t.snap : t.getReady}
          </span>
        )}
      </div>
    </>
  );
}

function InvitePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/b/${code}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${t.whatsappText} ${link}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="invite-title">
      <h2 id="invite-title" className="font-display text-xl font-semibold">
        {t.inviteTitle}
      </h2>
      <p
        className="rounded-2xl border-2 border-dashed border-line bg-surface px-4 py-3 font-medium break-all"
        data-testid="invite-link"
      >
        {link}
      </p>
      <a className={buttonPrimary} href={whatsapp} target="_blank" rel="noopener noreferrer">
        {t.shareWhatsApp}
      </a>
      <button type="button" className={buttonSecondary} onClick={copy}>
        {copied ? t.copied : t.copyLink}
      </button>
    </section>
  );
}

function ShotProgress({ captured, current }: { captured: boolean[]; current: number | null }) {
  const n = (current ?? SHOTS_PER_PERSON - 1) + 1;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-display text-xl font-semibold">{t.shotOf(n, SHOTS_PER_PERSON)}</p>
      <ol className="flex gap-2" aria-hidden>
        {captured.map((done, i) => (
          <li
            key={i}
            className={`size-3.5 rounded-full border-2 border-heart ${done ? "bg-heart" : i === current ? "bg-strawberry" : ""}`}
          />
        ))}
      </ol>
      <p className="text-center text-ink-soft">{t.countdownLine}</p>
    </div>
  );
}

export function SessionScreen({ booth, code }: { booth: BoothState; code: string }) {
  const { session, role, camera, partner, offset } = booth;
  if (!session || !role) return null;

  const partnerRole: Role = role === "host" ? "guest" : "host";
  const status = session.status;
  const capturing = status === "CAPTURING" && session.fireAt !== null && offset !== null;
  const waitingForPartner = !session.hasGuest || !partner.online;

  const partnerPlaceholder = !session.hasGuest
    ? t.waitingPartner
    : !partner.online
      ? t.partnerAway
      : camera.stream
        ? t.partnerNoVideo
        : t.cameraOff;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-5 pb-10">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-2xl font-bold">
          {id.appName}
        </Link>
        <p className="rounded-full bg-surface px-3 py-1 text-sm">
          <span className="text-ink-soft">{t.codeLabel} </span>
          <span className="font-display font-semibold tracking-wider" data-testid="booth-code">
            {session.code}
          </span>
        </p>
      </header>

      <section className="relative" aria-label={`${t.codeLabel} ${session.code}`}>
        <RouteLine traveling={waitingForPartner} className="-mb-1" />
        <div className="grid grid-cols-2 gap-3">
          <VideoWindow
            label={id.you}
            tint="bg-strawberry"
            stream={camera.stream}
            mirrored
            videoRef={camera.videoRef}
            placeholder={t.cameraOff}
            testId="self-video"
          />
          <VideoWindow
            label={id.partner}
            tint="bg-sky"
            stream={partner.stream}
            placeholder={partnerPlaceholder}
            testId="partner-video"
          />
        </div>
        {capturing && (
          <Countdown key={session.fireAt} localFireAt={serverToLocal(session.fireAt!, offset!)} />
        )}
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {session.hasGuest && status === "WAITING_READY" && (
          <p className="flex items-center justify-center gap-2 font-display text-lg font-medium">
            <Heart className="size-6" pulse={partner.online} />
            {partner.online ? t.partnerHere : t.partnerAway}
          </p>
        )}

        {camera.error && (
          <p role="alert" className="rounded-2xl bg-surface p-4 leading-relaxed">
            {CAMERA_ERROR_TEXT[camera.error]}
          </p>
        )}

        {/* Saat menunggu tamu, mengundang adalah aksi utama; kamera bisa menyusul. */}
        {status === "WAITING_GUEST" && role === "host" && <InvitePanel code={code} />}

        {NEEDS_CAMERA.has(status) && !camera.stream && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={status === "WAITING_GUEST" ? buttonSecondary : buttonPrimary}
              onClick={camera.enable}
              disabled={camera.state === "starting"}
            >
              {camera.state === "starting" ? t.enablingCamera : t.enableCamera}
            </button>
            <p className="text-center text-sm text-ink-soft">{t.cameraIntro}</p>
          </div>
        )}

        {status === "WAITING_READY" && (
          <ReadyPanel booth={booth} role={role} partnerReady={session.ready[partnerRole]} />
        )}

        {status === "CAPTURING" && (
          <ShotProgress captured={session.shots[role].map((s) => s.captured)} current={session.currentShot} />
        )}

        {booth.upload.slow && <p className="text-center text-ink-soft">{t.uploadSlow}</p>}
        {booth.upload.failedShots.length > 0 && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            <p>{t.uploadFailed}</p>
            <button type="button" className={buttonSecondary} onClick={booth.upload.retry}>
              {t.retryUpload}
            </button>
          </div>
        )}

        {status === "COMPOSING" && (
          <div className="flex flex-col items-center gap-2 text-center" role="status">
            <Heart className="size-10" pulse />
            <p className="font-display text-xl font-semibold">{t.composing}</p>
            <p className="text-ink-soft">{t.composingHint}</p>
          </div>
        )}

        {status === "PAUSED" && <p className="text-center font-display text-lg">{t.paused}</p>}
        {(status === "EXPIRED" || status === "DONE") && (
          <p className="text-center font-display text-lg">{t.gone}</p>
        )}
      </section>

      {status === "REVIEW" && <ReviewPanel booth={booth} />}
    </main>
  );
}

function ReadyPanel({ booth, role, partnerReady }: { booth: BoothState; role: Role; partnerReady: boolean }) {
  const meReady = booth.session!.ready[role];
  return (
    <div className="flex flex-col gap-3">
      {meReady ? (
        <>
          <p className="text-center font-display text-lg font-semibold">
            {partnerReady ? t.partnerReady : t.waitingPartnerReady}
          </p>
          <button type="button" className={buttonQuiet} onClick={() => booth.setReady(false)}>
            {t.notReady}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`${buttonPrimary} min-h-16 text-2xl`}
            onClick={() => booth.setReady(true)}
            disabled={!booth.camera.stream}
          >
            {t.ready}
          </button>
          <p className="text-center text-sm text-ink-soft">{partnerReady ? t.partnerReady : t.readyHint}</p>
        </>
      )}
    </div>
  );
}

function ReviewPanel({ booth }: { booth: BoothState }) {
  const slug = booth.session?.stripSlug;
  return (
    <section className="flex flex-col items-center gap-4" aria-labelledby="review-title">
      <Confetti />
      <h2 id="review-title" className="text-center font-display text-2xl font-bold">
        {t.reviewTitle}
      </h2>
      {booth.strip ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Storage, bukan aset statis */}
          <img
            src={booth.strip.url}
            alt={t.stripAlt}
            width={600}
            height={1800}
            className="w-48 rounded-xl shadow-[0_8px_0_0_var(--strawberry)]"
            data-testid="strip-image"
          />
          <a href={booth.strip.downloadUrl} className={`${buttonPrimary} w-full`} download>
            {t.download}
          </a>
          {slug && (
            <Link href={`/s/${slug}`} className={buttonQuiet}>
              {t.openResult}
            </Link>
          )}
        </>
      ) : (
        <Heart className="size-10" pulse />
      )}
    </section>
  );
}
