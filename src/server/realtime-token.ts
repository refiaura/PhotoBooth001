import "server-only";
import { SignJWT } from "jose";
import { serverEnv } from "./env";

export const REALTIME_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/**
 * JWT pendek untuk kanal Realtime privat `booth:<boothId>` (keputusan K1).
 * Policy RLS di realtime.messages mencocokkan klaim booth_id dengan nama kanal.
 */
export async function createRealtimeToken(boothId: string, participantId: string): Promise<string> {
  const secret = new TextEncoder().encode(serverEnv().SUPABASE_JWT_SECRET);
  return new SignJWT({ role: "authenticated", booth_id: boothId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(participantId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${REALTIME_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export const boothChannel = (boothId: string) => `booth:${boothId}`;
