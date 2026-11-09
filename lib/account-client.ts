import type { SessionState } from "@/lib/mock/session";

export type AccountResult = { account: SessionState | null; error?: string };

export async function fetchMyAccount(): Promise<AccountResult> {
  try {
    const res = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return { account: null, error: "Could not load your account" };
    return (await res.json()) as AccountResult;
  } catch {
    return { account: null, error: "Could not reach the server" };
  }
}
