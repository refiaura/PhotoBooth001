"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, api, type PublicSession, type SessionResponse } from "@/client/api";
import { cameraErrorKind, startCamera, stopStream, type CameraError } from "@/client/camera";
import { encodeFrame, grabFrame, type CapturedPhoto } from "@/client/capture";
import { calibrateClock } from "@/client/clock";
import {
  connectBoothRealtime,
  type BoothRealtime,
  type RealtimeStatus,
  type RtcSignal,
} from "@/client/realtime";
import { PeerLink } from "@/client/rtc";
import { loadToken, saveToken } from "@/client/token-store";
import { submitPhoto } from "@/client/upload";
import { serverToLocal } from "@/domain/clock-sync";
import { orphanedShots } from "@/domain/recovery";
import type { Role } from "@/domain/session-machine";

export type BlockedReason = "not-found" | "full" | "gone" | "error";
type View =
  { kind: "loading" } | { kind: "join" } | { kind: "blocked"; reason: BlockedReason } | { kind: "session" };
type Auth = { token: string } & Pick<SessionResponse, "role" | "realtime" | "iceServers">;

/** Status setelah sesi selesai: kamera tidak lagi dibutuhkan. */
const CAMERA_DONE = new Set(["REVIEW", "DONE", "EXPIRED"]);
/** Selama komposisi belum selesai, klien memintanya ulang tiap interval ini (idempoten di server). */
const COMPOSE_NUDGE_MS = 10_000;
/** Cadangan bila Realtime belum tersambung: ambil snapshot berkala (lebih rapat saat menjepret). */
const POLL_MS = 4000;
const POLL_CAPTURING_MS = 1000;

declare global {
  interface Window {
    /** Diisi oleh tes E2E untuk mengukur selisih momen jepret antarperangkat. */
    __rinduCaptures?: Array<{ role: Role; shotIndex: number; at: number }>;
  }
}

function blockedReason(err: unknown): BlockedReason {
  if (!(err instanceof ApiClientError)) return "error";
  if (err.status === 404) return "not-found";
  if (err.code === "FULL") return "full";
  if (err.code === "GONE") return "gone";
  return "error";
}

export function useBooth(code: string) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [auth, setAuth] = useState<Auth | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on">("off");
  const [cameraError, setCameraError] = useState<CameraError | null>(null);

  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [rtcState, setRtcState] = useState<RTCPeerConnectionState | "idle">("idle");
  /** Bertambah setiap tamu mengirim `hello`; host lalu membuat offer baru. */
  const [helloSeq, setHelloSeq] = useState(0);

  const [uploadSlow, setUploadSlow] = useState(false);
  const [failedShots, setFailedShots] = useState<number[]>([]);
  /** Shot yang fotonya sedang diproses atau masih tersimpan di memori perangkat ini. */
  const [pendingShots, setPendingShots] = useState<number[]>([]);
  const [strip, setStrip] = useState<{ url: string; downloadUrl: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const realtimeRef = useRef<BoothRealtime | null>(null);
  const linkRef = useRef<PeerLink | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onSignalRef = useRef<(signal: RtcSignal) => void>(() => {});
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const capturedRef = useRef(new Map<number, CapturedPhoto>());
  const firedRef = useRef(new Set<string>());

  /** Menerima snapshot dari respons HTTP atau siaran; abaikan yang lebih tua (urutan bisa acak). */
  const applySession = useCallback((next: PublicSession) => {
    setSession((prev) => (!prev || next.serverNow >= prev.serverNow ? next : prev));
  }, []);

  const enter = useCallback(
    (token: string, res: SessionResponse) => {
      setAuth({ token, role: res.role, realtime: res.realtime, iceServers: res.iceServers });
      applySession(res.session);
      setView({ kind: "session" });
    },
    [applySession],
  );

  // 1. Masuk: pakai token tersimpan bila ada (rejoin), kalau tidak tampilkan layar join.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = loadToken(code);
      if (token) {
        try {
          const res = await api.session(code, token);
          if (!cancelled) enter(token, res);
          return;
        } catch (err) {
          if (!(err instanceof ApiClientError && err.status === 401)) {
            if (!cancelled) setView({ kind: "blocked", reason: blockedReason(err) });
            return;
          }
        }
      }
      try {
        const info = await api.boothInfo(code);
        if (cancelled) return;
        if (info.status === "EXPIRED" || info.status === "DONE") setView({ kind: "blocked", reason: "gone" });
        else if (info.full) setView({ kind: "blocked", reason: "full" });
        else setView({ kind: "join" });
      } catch (err) {
        if (!cancelled) setView({ kind: "blocked", reason: blockedReason(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, enter]);

  const join = useCallback(async () => {
    setJoining(true);
    try {
      const joined = await api.join(code);
      saveToken(code, joined.token);
      enter(joined.token, await api.session(code, joined.token));
    } catch (err) {
      setView({ kind: "blocked", reason: blockedReason(err) });
    } finally {
      setJoining(false);
    }
  }, [code, enter]);

  const refresh = useCallback(async () => {
    if (!auth) return;
    try {
      applySession((await api.state(code, auth.token)).session);
    } catch {
      // Dicoba lagi pada siklus berikutnya.
    }
  }, [auth, code, applySession]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // 2. Kalibrasi jam sekali per sesi.
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    calibrateClock()
      .then((o) => !cancelled && setOffset(o))
      .catch(() => !cancelled && setOffset(0));
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // 3. Realtime: state dari server, sinyal WebRTC, kehadiran pasangan.
  useEffect(() => {
    if (!auth) return;
    let disposed = false;
    const partner: Role = auth.role === "host" ? "guest" : "host";
    connectBoothRealtime({
      channel: auth.realtime.channel,
      token: auth.realtime.token,
      role: auth.role,
      onStateChanged: () => void refreshRef.current(),
      onSignal: (signal) => onSignalRef.current(signal),
      onPresence: (online) => setPartnerOnline(online.includes(partner)),
      onStatus: setRealtimeStatus,
    }).then((rt) => {
      if (disposed) rt.close();
      else realtimeRef.current = rt;
    });
    return () => {
      disposed = true;
      realtimeRef.current?.close();
      realtimeRef.current = null;
    };
  }, [auth]);

  // Sinkron ulang setiap kali Realtime tersambung; polling bila belum/putus.
  useEffect(() => {
    if (!auth) return;
    if (realtimeStatus === "connected") {
      api
        .state(code, auth.token)
        .then((res) => applySession(res.session))
        .catch(() => {});
      return;
    }
    const timer = setInterval(refresh, session?.status === "CAPTURING" ? POLL_CAPTURING_MS : POLL_MS);
    return () => clearInterval(timer);
  }, [auth, code, realtimeStatus, refresh, applySession, session?.status]);

  // 4. Kamera: hanya setelah tombol ditekan; mati saat sesi selesai atau halaman ditutup.
  const enableCamera = useCallback(async () => {
    setCameraState("starting");
    setCameraError(null);
    try {
      setStream(await startCamera());
      setCameraState("on");
    } catch (err) {
      setCameraError(cameraErrorKind(err));
      setCameraState("off");
    }
  }, []);

  const sessionOver = session ? CAMERA_DONE.has(session.status) : false;
  useEffect(() => {
    if (!stream) return;
    if (sessionOver) {
      stopStream(stream);
      return;
    }
    const stop = () => stopStream(stream);
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, [stream, sessionOver]);

  useEffect(() => () => stopStream(stream), [stream]);

  // 5. Jepret tepat pada fireAt (jam server → jam lokal), dari kamera lokal.
  const sendPhoto = useCallback(
    async (shotIndex: number, photo: CapturedPhoto) => {
      if (!auth) return;
      setFailedShots((prev) => prev.filter((s) => s !== shotIndex));
      try {
        const res = await submitPhoto({
          code,
          token: auth.token,
          shotIndex,
          photo,
          onRetry: () => setUploadSlow(true),
        });
        applySession(res.session);
        capturedRef.current.delete(shotIndex);
        setPendingShots((prev) => prev.filter((s) => s !== shotIndex));
      } catch (err) {
        console.error("[upload] gagal", err);
        setFailedShots((prev) => [...prev, shotIndex]);
      } finally {
        setUploadSlow(false);
      }
    },
    [auth, code, applySession],
  );

  const status = session?.status;
  const currentShot = session?.currentShot ?? null;
  const fireAt = session?.fireAt ?? null;
  const alreadyCaptured =
    auth && session && currentShot !== null ? session.shots[auth.role][currentShot]?.captured : true;

  useEffect(() => {
    if (!auth || status !== "CAPTURING" || fireAt === null || currentShot === null || offset === null) return;
    if (alreadyCaptured || !stream) return;
    const key = `${currentShot}:${fireAt}`;
    if (firedRef.current.has(key)) return;

    const delay = Math.max(0, serverToLocal(fireAt, offset) - Date.now());
    const timer = setTimeout(async () => {
      const video = videoRef.current;
      if (!video || firedRef.current.has(key)) return;
      firedRef.current.add(key);
      setPendingShots((prev) => [...prev, currentShot]);
      const canvas = grabFrame(video);
      window.__rinduCaptures?.push({ role: auth.role, shotIndex: currentShot, at: Date.now() });
      const photo = await encodeFrame(canvas);
      capturedRef.current.set(currentShot, photo);
      await sendPhoto(currentShot, photo);
    }, delay);
    return () => clearTimeout(timer);
  }, [auth, status, fireAt, currentShot, offset, alreadyCaptured, stream, sendPhoto]);

  // 5b. Pemulihan: foto yang tercatat dijepret tapi hilang dari perangkat (mis. reload di tengah
  // unggahan) diganti frame baru, agar sesi tidak menunggu selamanya di COMPOSING.
  const orphans =
    auth && session ? orphanedShots(session.status, session.shots[auth.role], new Set(pendingShots)) : [];
  const orphanKey = orphans.join(",");

  useEffect(() => {
    if (!stream || orphanKey === "") return;
    const shots = orphanKey.split(",").map(Number);
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryRecover = async () => {
      const video = videoRef.current;
      // Kamera baru menyala: tunggu sampai frame pertama tersedia.
      if (!video?.videoWidth) {
        if (++attempts < 20) timer = setTimeout(tryRecover, 500);
        return;
      }
      setPendingShots((prev) => [...prev, ...shots]);
      const photo = await encodeFrame(grabFrame(video));
      for (const shot of shots) {
        capturedRef.current.set(shot, photo);
        void sendPhoto(shot, photo);
      }
    };
    timer = setTimeout(tryRecover, 0);
    return () => clearTimeout(timer);
  }, [stream, orphanKey, sendPhoto]);

  const retryFailed = useCallback(() => {
    for (const shot of failedShots) {
      const photo = capturedRef.current.get(shot);
      if (photo) void sendPhoto(shot, photo);
    }
  }, [failedShots, sendPhoto]);

  // 6. Komposisi macet? Minta ulang berkala selama masih COMPOSING (server menjamin hanya sekali).
  useEffect(() => {
    if (!auth || status !== "COMPOSING") return;
    const timer = setInterval(async () => {
      try {
        applySession((await api.composeStrip(code, auth.token)).session);
      } catch {
        void refresh();
      }
    }, COMPOSE_NUDGE_MS);
    return () => clearInterval(timer);
  }, [auth, status, code, applySession, refresh]);

  // 7. Hasil siap: ambil signed URL photostrip.
  const stripSlug = session?.stripSlug ?? null;
  useEffect(() => {
    if (status !== "REVIEW" || !stripSlug) return;
    let cancelled = false;
    api
      .strip(stripSlug)
      .then((res) => !cancelled && setStrip(res.strip))
      .catch(() => !cancelled && setStrip(null));
    return () => {
      cancelled = true;
    };
  }, [status, stripSlug]);

  // 8. Preview pasangan via WebRTC. Host selalu yang membuat offer; tamu menjawab.
  useEffect(() => {
    streamRef.current = sessionOver ? null : stream;
  }, [stream, sessionOver]);

  const makeLink = useCallback(
    (initiator: boolean, localStream: MediaStream, linkId: string) => {
      if (!auth) return null;
      linkRef.current?.close();
      const link = new PeerLink({
        iceServers: auth.iceServers,
        initiator,
        linkId,
        localStream,
        send: (signal) => realtimeRef.current?.sendSignal({ ...signal, from: auth.role }),
        onRemoteStream: setRemoteStream,
        onConnectionState: setRtcState,
      });
      linkRef.current = link;
      return link;
    },
    [auth],
  );

  const onSignal = useCallback(
    (signal: RtcSignal) => {
      if (!auth) return;
      if (auth.role === "host") {
        if (signal.hello) setHelloSeq((n) => n + 1);
        else void linkRef.current?.handleSignal(signal);
        return;
      }
      // Tamu: setiap offer baru (mis. host refresh) memulai koneksi baru.
      if (signal.description?.type === "offer" && signal.linkId !== linkRef.current?.linkId) {
        if (!streamRef.current || !signal.linkId) return;
        makeLink(false, streamRef.current, signal.linkId);
      }
      void linkRef.current?.handleSignal(signal);
    },
    [auth, makeLink],
  );

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  const rtcReady = !!auth && !!stream && realtimeStatus === "connected" && !sessionOver;

  useEffect(() => {
    if (!rtcReady || auth.role !== "host" || !partnerOnline) return;
    const link = makeLink(true, stream, crypto.randomUUID());
    return () => {
      link?.close();
      if (linkRef.current === link) linkRef.current = null;
      setRemoteStream(null);
      setRtcState("idle");
    };
  }, [rtcReady, auth, stream, partnerOnline, helloSeq, makeLink]);

  useEffect(() => {
    if (!rtcReady || auth.role !== "guest") return;
    realtimeRef.current?.sendSignal({ from: "guest", hello: true });
    return () => {
      linkRef.current?.close();
      linkRef.current = null;
      setRemoteStream(null);
      setRtcState("idle");
    };
  }, [rtcReady, auth]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!auth) return;
      try {
        applySession((await api.setReady(code, auth.token, ready)).session);
      } catch {
        void refresh();
      }
    },
    [auth, code, applySession, refresh],
  );

  return {
    view,
    join,
    joining,
    role: auth?.role ?? null,
    session,
    offset,
    camera: {
      // Setelah sesi selesai, track sudah dimatikan: anggap kamera mati.
      stream: sessionOver ? null : stream,
      state: sessionOver ? ("off" as const) : cameraState,
      error: cameraError,
      enable: enableCamera,
      videoRef,
    },
    partner: { online: partnerOnline, stream: remoteStream, rtcState },
    setReady,
    upload: { slow: uploadSlow, failedShots, retry: retryFailed },
    recovery: { needed: orphans.length > 0 },
    strip,
  };
}

export type BoothState = ReturnType<typeof useBooth>;
