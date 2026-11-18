import "server-only";
import type { NextResponse } from "next/server";
import type { Account, DigiLockerMode } from "@/lib/digilocker/contract";
import { digilockerKey, openJson, sealJson } from "@/lib/digilocker/seal";

export const STATE_COOKIE = "nagrek_dl_state";
export const SESSION_COOKIE = "nagrek_dl_session";

export type StatePayload = { state: string; verifier: string; exp: number };
export type SessionPayload = {
  mode: DigiLockerMode;
  accessToken: string;
  expiresAt: number;
  account: Account;
};

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/api/digilocker",
  secure: process.env.NODE_ENV === "production",
};

export function writeStateCookie(response: NextResponse, payload: StatePayload): boolean {
  const key = digilockerKey();
  if (!key) return false;
  response.cookies.set(STATE_COOKIE, sealJson(payload, key), { ...cookieBase, maxAge: 10 * 60 });
  return true;
}

export function readStateCookie(value: string | undefined): StatePayload | null {
  const key = digilockerKey();
  if (!key || !value) return null;
  const payload = openJson<StatePayload>(value, key);
  if (!payload || typeof payload.state !== "string" || typeof payload.verifier !== "string") return null;
  if (payload.exp <= Date.now()) return null;
  return payload;
}

export function writeSessionCookie(response: NextResponse, payload: SessionPayload): boolean {
  const key = digilockerKey();
  if (!key) return false;
  const sealed = sealJson(payload, key);
  if (sealed.length > 3500) return false;
  const maxAge = Math.max(1, Math.floor((payload.expiresAt - Date.now()) / 1000));
  response.cookies.set(SESSION_COOKIE, sealed, { ...cookieBase, maxAge });
  return true;
}

export function readSessionCookie(value: string | undefined, now = Date.now()): SessionPayload | "expired" | null {
  const key = digilockerKey();
  if (!key || !value) return null;
  const payload = openJson<SessionPayload>(value, key);
  if (!payload || typeof payload.accessToken !== "string" || !payload.account) return null;
  if (payload.expiresAt <= now) return "expired";
  return payload;
}

export function clearStateCookie(response: NextResponse): void {
  response.cookies.set(STATE_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function clearLockerCookies(response: NextResponse): void {
  clearStateCookie(response);
  response.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
}
