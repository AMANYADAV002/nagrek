import { createHmac, timingSafeEqual } from "node:crypto";
import { isAdultDob } from "@/lib/security/kyc";
import type { Account, DocumentBytes, DocumentMeta } from "@/lib/digilocker/contract";
import { OFFICIAL_ORIGIN, type OfficialSettings } from "@/lib/digilocker/mode";

/**
 * DigiLocker Authorized Partner API Specification v2.0.
 * Refresh-token exchange was removed in that specification, so an expired
 * access token requires the person to authorize again.
 * The Aadhaar signup API is intentionally not implemented.
 */

const URI_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,180}$/;

export function safeDocumentUri(uri: string): boolean {
  return URI_PATTERN.test(uri);
}

export function isAadhaarDocument(parts: { uri?: string; name?: string; description?: string; doctype?: string }): boolean {
  return /aadhaar|adhar|eaadhaar/i.test([parts.doctype, parts.description, parts.name, parts.uri].filter(Boolean).join(" "));
}

export function adultFromLockerDob(dob: string, today = new Date()): boolean | null {
  if (!/^\d{8}$/.test(dob)) return null;
  const iso = `${dob.slice(4, 8)}-${dob.slice(2, 4)}-${dob.slice(0, 2)}`;
  return isAdultDob(iso, today);
}

export function authorizeUrl(settings: OfficialSettings, state: string, codeChallenge: string): string {
  const url = new URL("/public/oauth2/1/authorize", OFFICIAL_ORIGIN);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("redirect_uri", settings.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function parseTokenResponse(payload: unknown): { accessToken: string; expiresIn: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.access_token !== "string" || record.access_token.length < 8) return null;
  if (typeof record.expires_in !== "number" || record.expires_in <= 0) return null;
  return { accessToken: record.access_token, expiresIn: record.expires_in };
}

export function parseAccount(payload: unknown, today = new Date()): Account | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.digilockerid !== "string" || typeof record.name !== "string") return null;
  const adult = typeof record.dob === "string" ? adultFromLockerDob(record.dob, today) : null;
  return { digilockerId: record.digilockerid, name: record.name, adult };
}

export function parseDocumentList(payload: unknown): DocumentMeta[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const documents: DocumentMeta[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "dir" || typeof row.uri !== "string" || !safeDocumentUri(row.uri.trim())) continue;
    const mimeSource = row.mime;
    const mime = Array.isArray(mimeSource)
      ? mimeSource.filter((value): value is string => typeof value === "string")
      : typeof mimeSource === "string" && mimeSource
        ? [mimeSource]
        : [];
    const description = typeof row.description === "string" ? row.description : "";
    const name = typeof row.name === "string" ? row.name : "Document";
    const doctype = typeof row.doctype === "string" ? row.doctype : "";
    documents.push({
      uri: row.uri.trim(),
      name,
      description,
      issuer: typeof row.issuer === "string" ? row.issuer : "",
      mime,
      date: typeof row.date === "string" ? row.date.trim() : "",
      downloadable: !isAadhaarDocument({ uri: row.uri, name, description, doctype }),
      simulated: false,
    });
  }
  return documents;
}

export function verifyFileHmac(body: Buffer, header: string | null, clientSecret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", clientSecret).update(body).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(header);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function exchangeOfficialCode(
  settings: OfficialSettings,
  input: { code: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number } | "invalid_code" | "backend"> {
  let response: Response;
  try {
    response = await fetchImpl(`${OFFICIAL_ORIGIN}/public/oauth2/2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        grant_type: "authorization_code",
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: settings.redirectUri,
        code_verifier: input.codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return "backend";
  }
  if (!response.ok) return "invalid_code";
  try {
    return parseTokenResponse(await response.json()) ?? "invalid_code";
  } catch {
    return "backend";
  }
}

export async function officialAccount(accessToken: string, fetchImpl: typeof fetch = fetch, today = new Date()): Promise<Account | "expired" | "backend"> {
  const result = await authedGet(`${OFFICIAL_ORIGIN}/public/oauth2/1/user`, accessToken, fetchImpl);
  if (result === "expired" || result === "backend") return result;
  return parseAccount(result, today) ?? "backend";
}

export async function officialDocuments(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<DocumentMeta[] | "expired" | "backend"> {
  const issued = await authedGet(`${OFFICIAL_ORIGIN}/public/oauth2/2/files/issued`, accessToken, fetchImpl);
  if (issued === "expired" || issued === "backend") return issued;
  const uploaded = await authedGet(`${OFFICIAL_ORIGIN}/public/oauth2/1/files`, accessToken, fetchImpl);
  const uploadedItems = uploaded === "expired" || uploaded === "backend" ? [] : parseDocumentList(uploaded);
  return [...parseDocumentList(issued), ...uploadedItems];
}

export async function officialFile(
  settings: OfficialSettings,
  accessToken: string,
  uri: string,
  format: "pdf" | "xml",
  fetchImpl: typeof fetch = fetch,
): Promise<DocumentBytes | "expired" | "not_found" | "aadhaar_blocked" | "backend"> {
  if (!safeDocumentUri(uri)) return "not_found";
  if (isAadhaarDocument({ uri })) return "aadhaar_blocked";
  const path = format === "xml" ? "xml" : "file";
  let response: Response;
  try {
    response = await fetchImpl(`${OFFICIAL_ORIGIN}/public/oauth2/1/${path}/${encodeURIComponent(uri)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return "backend";
  }
  if (response.status === 401) return "expired";
  if (response.status === 404) return "not_found";
  if (!response.ok) return "backend";
  const body = Buffer.from(await response.arrayBuffer());
  if (!verifyFileHmac(body, response.headers.get("hmac"), settings.clientSecret)) return "backend";
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || (format === "xml" ? "application/xml" : "application/pdf");
  return { body, contentType, filename: format === "xml" ? "document.xml" : "document.pdf", simulated: false };
}

export async function revokeOfficialToken(settings: OfficialSettings, accessToken: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString("base64");
  try {
    const response = await fetchImpl(`${OFFICIAL_ORIGIN}/public/oauth2/1/revoke`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: accessToken, token_type_hint: "access_token" }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function authedGet(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<unknown | "expired" | "backend"> {
  try {
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (response.status === 401) return "expired";
    if (!response.ok) return "backend";
    return await response.json();
  } catch {
    return "backend";
  }
}
