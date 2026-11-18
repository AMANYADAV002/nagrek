import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keyFromSecret } from "@/lib/security/vault-crypto";
import { MOCK_LICENCE_URI, mockDocument, mockDocuments, mockExchange } from "@/lib/digilocker/mock";
import { digilockerMode, officialSettings } from "@/lib/digilocker/mode";
import { createPkce, statesMatch } from "@/lib/digilocker/pkce";
import { openJson, sealJson } from "@/lib/digilocker/seal";
import {
  authorizeUrl, exchangeOfficialCode, isAadhaarDocument, officialFile, parseAccount, parseDocumentList, parseTokenResponse, verifyFileHmac,
} from "@/lib/digilocker/official";

const settings = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/digilocker/callback",
};
const key = keyFromSecret("test-session");

describe("digilocker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("completes a simulated authorization and reads a sample file", () => {
    const grant = mockExchange("mock-auth-code", 1_700_000_000_000);
    expect(grant).not.toBe("invalid_code");
    if (grant === "invalid_code") return;
    expect(grant.account.name).toBe("Simulated Citizen");
    expect(grant.account.adult).toBe(true);
    const documents = mockDocuments(grant.accessToken, 1_700_000_000_000);
    expect(documents).not.toBe("expired");
    if (!Array.isArray(documents)) return;
    expect(documents.every((item) => item.simulated)).toBe(true);
    const file = mockDocument(grant.accessToken, MOCK_LICENCE_URI, "pdf", 1_700_000_000_000);
    expect(file).toMatchObject({ simulated: true, contentType: "application/pdf" });
    if (typeof file === "string") return;
    expect(file.body.toString("utf8")).toContain("SIMULATED - NOT A GOVERNMENT DOCUMENT");
  });

  it("rejects a bad code, a bad state, an expired token, an empty locker, and an unknown file", () => {
    expect(mockExchange("nope")).toBe("invalid_code");
    expect(statesMatch("a".repeat(32), "b".repeat(32))).toBe(false);
    expect(statesMatch("abc", "abc")).toBe(false);
    const expired = mockDocuments("mock.1.ok", 10);
    expect(expired).toBe("expired");
    const empty = mockExchange("mock-empty-code", 1_700_000_000_000);
    if (typeof empty === "string") throw new Error("expected an empty grant");
    expect(mockDocuments(empty.accessToken, 1_700_000_000_000)).toEqual([]);
    expect(mockDocument(empty.accessToken, "sim:missing", "pdf", 1_700_000_000_000)).toBe("not_found");
    expect(mockDocuments("someone-else", 1_700_000_000_000)).toBe("unauthorized");
  });

  it("seals the session and rejects tampering", () => {
    const sealed = sealJson({ accessToken: "secret-token" }, key);
    expect(sealed).not.toContain("secret-token");
    expect(openJson(sealed, key)).toEqual({ accessToken: "secret-token" });
    const [iv, tag, ciphertext] = sealed.split(".");
    expect(openJson(`${iv}.${tag}.${ciphertext.slice(0, -1)}x`, key)).toBeNull();
    expect(openJson(sealed, keyFromSecret("other"))).toBeNull();
  });

  it("keeps mock mode out of production unless it is chosen, and requires official credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DIGILOCKER_MODE", "");
    expect(digilockerMode()).toBe("off");
    vi.stubEnv("DIGILOCKER_MODE", "mock");
    expect(digilockerMode()).toBe("mock");
    vi.stubEnv("DIGILOCKER_CLIENT_ID", "");
    expect(officialSettings()).toBeNull();
    vi.stubEnv("DIGILOCKER_CLIENT_ID", "client-id");
    vi.stubEnv("DIGILOCKER_CLIENT_SECRET", "client-secret");
    vi.stubEnv("DIGILOCKER_REDIRECT_URI", "http://example.com/callback");
    expect(officialSettings()).toBeNull();
  });

  it("builds the documented authorization URL and does not request an identity number", () => {
    const { challenge } = createPkce(Buffer.from("verifier-verifier-verifier-verifier"));
    const url = new URL(authorizeUrl(settings, "state-state-state-state", challenge));
    expect(url.origin).toBe("https://digilocker.meripehchaan.gov.in");
    expect(url.pathname).toBe("/public/oauth2/1/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("acr")).toBe(false);
    expect(url.searchParams.get("client_secret")).toBeNull();
  });

  it("parses a token and account without keeping the identity token or date of birth", () => {
    expect(parseTokenResponse({ access_token: "token-token", expires_in: 3600, id_token: "do-not-keep" })).toEqual({
      accessToken: "token-token",
      expiresIn: 3600,
    });
    const account = parseAccount({ digilockerid: "locker-1", name: "Asha", dob: "01011990", pan_number: "hidden" }, new Date("2026-11-15T00:00:00Z"));
    expect(account).toEqual({ digilockerId: "locker-1", name: "Asha", adult: true });
    expect(account).not.toHaveProperty("dob");
    expect(parseAccount({ digilockerid: "locker-1", name: "Child", dob: "01012015" }, new Date("2026-11-15T00:00:00Z"))?.adult).toBe(false);
  });

  it("lists documents, blocks Aadhaar downloads, and checks the file signature", async () => {
    const documents = parseDocumentList({
      items: [
        { name: "Class XII Marksheet", type: "file", uri: "in.gov.cbse-HSCER-20140001", mime: "application/pdf", description: "Class XII Marksheet", issuer: "CBSE" },
        { name: "eAadhaar", type: "file", uri: "in.gov.uidai-ADHAR-0001", doctype: "ADHAR", description: "Aadhaar" },
        { type: "dir", name: "Folder" },
      ],
    });
    expect(documents).toHaveLength(2);
    expect(documents[1]?.downloadable).toBe(false);
    expect(isAadhaarDocument({ uri: "in.gov.uidai-ADHAR-0001" })).toBe(true);
    const body = Buffer.from("file-bytes");
    const hmac = createHmac("sha256", settings.clientSecret).update(body).digest("base64");
    expect(verifyFileHmac(body, hmac, settings.clientSecret)).toBe(true);
    expect(verifyFileHmac(body, null, settings.clientSecret)).toBe(false);

    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    expect(await exchangeOfficialCode(settings, { code: "bad", codeVerifier: "verifier" }, fetchImpl)).toBe("invalid_code");
    const down = vi.fn<typeof fetch>(async () => {
      throw new Error("offline");
    });
    expect(await officialFile(settings, "token-token", "in.gov.cbse-HSCER-20140001", "pdf", down)).toBe("backend");
  });
});
