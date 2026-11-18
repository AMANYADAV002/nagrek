import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adultFromDigilocker, setuRedirectAllowed, stripDateFields } from "@/lib/kyc/age";
import { sandboxRouteAllowed } from "@/lib/kyc/mode";
import { parseKycEvent } from "@/lib/security/kyc";

const USER = "94ba99be-4331-4b6e-ac37-c7979d463c21";
const TODAY = new Date("2026-11-15T00:00:00Z");

describe("digilocker age gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts an adult date and rejects a minor without returning the payload", () => {
    const adult = { aadhaar: { dateOfBirth: "01-01-2000", name: "hidden" } };
    const minor = { aadhaar: { dateOfBirth: "01-01-2015" } };
    expect(adultFromDigilocker(adult, TODAY)).toBe(true);
    expect(adultFromDigilocker(minor, TODAY)).toBe(false);
    expect(adultFromDigilocker({ aadhaar: { name: "hidden" } }, TODAY)).toBeNull();
    expect(typeof adultFromDigilocker(adult, TODAY)).toBe("boolean");
  });

  it("strips the date and still rejects an identity payload", () => {
    const stripped = stripDateFields({
      reference: "ref-12345678",
      user_id: USER,
      status: "verified",
      age_verified: true,
      dateOfBirth: "01-01-2000",
      aadhaar: { dateOfBirth: "01-01-2000" },
    });
    expect(stripped).not.toMatchObject({ dateOfBirth: expect.anything() });
    expect(parseKycEvent(stripped)).toBeNull();
  });

  it("allows a dated event once the date field is removed and age was checked", () => {
    const stripped = stripDateFields({
      reference: "ref-12345678",
      user_id: USER,
      status: "verified",
      age_verified: false,
      dateOfBirth: "2000-01-01",
    });
    expect(parseKycEvent({ ...(stripped as object), age_verified: true })).toMatchObject({ status: "verified" });
  });

  it("disables the sandbox route in production and rejects unknown redirect hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KYC_SANDBOX_MODE", "true");
    expect(sandboxRouteAllowed()).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(sandboxRouteAllowed()).toBe(true);
    expect(setuRedirectAllowed("https://dg-sandbox.setu.co/consent")).toBe(true);
    expect(setuRedirectAllowed("https://evil.example/consent")).toBe(false);
    expect(setuRedirectAllowed("http://dg.setu.co/consent")).toBe(false);
  });

  it("publishes only the status table to the owner", () => {
    const sql = readFileSync("supabase/migrations/20261115200000_kyc_status.sql", "utf8");
    expect(sql).toContain("alter table public.kyc_status force row level security");
    expect(sql).toContain("grant select on public.kyc_status to authenticated");
    expect(sql).not.toContain("grant insert");
    expect(sql).not.toMatch(/token|reference_hash|aadhaar/i);
    expect(sql).toContain("supabase_realtime");
  });
});
