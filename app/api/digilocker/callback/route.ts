import { NextResponse, type NextRequest } from "next/server";
import { exchangeOfficialCode, officialAccount } from "@/lib/digilocker/official";
import { mockExchange } from "@/lib/digilocker/mock";
import { digilockerMode, officialSettings } from "@/lib/digilocker/mode";
import { statesMatch } from "@/lib/digilocker/pkce";
import { clearLockerCookies, clearStateCookie, readStateCookie, STATE_COOKIE, writeSessionCookie } from "@/lib/digilocker/session";
import { getMember } from "@/lib/server/caller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/digilocker?error=${error}`, request.url));
  clearLockerCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const member = await getMember();
  if ("error" in member) return back(request, "unauthorized");
  const mode = digilockerMode();
  if (mode === "off") return back(request, "unconfigured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "denied");
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";
  const pending = readStateCookie(request.cookies.get(STATE_COOKIE)?.value);
  if (!pending || !statesMatch(pending.state, state)) return back(request, "invalid_state");

  const grant = mode === "mock"
    ? mockExchange(code)
    : await (async () => {
        const settings = officialSettings();
        if (!settings) return "unconfigured" as const;
        const token = await exchangeOfficialCode(settings, { code, codeVerifier: pending.verifier });
        if (token === "invalid_code" || token === "backend") return token;
        const account = await officialAccount(token.accessToken);
        if (account === "expired" || account === "backend") return "backend" as const;
        return { accessToken: token.accessToken, expiresAt: Date.now() + token.expiresIn * 1000, account };
      })();

  if (grant === "invalid_code") return back(request, "invalid_code");
  if (grant === "unconfigured") return back(request, "unconfigured");
  if (grant === "backend") return back(request, "backend");

  const response = NextResponse.redirect(new URL("/digilocker", request.url));
  clearStateCookie(response);
  const saved = writeSessionCookie(response, { mode, ...grant });
  if (!saved) return back(request, "backend");
  return response;
}
