import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activePlan, daysLeft } from "@/lib/payments/plan-status";
import { hmacHex, isValidPaymentSignature, isValidWebhookSignature } from "@/lib/payments/signature";

describe("Razorpay signatures", () => {
  const secret = "test_secret";

  it("accepts the checkout signature for order|payment", () => {
    const sig = hmacHex(secret, "order_1|pay_1");
    expect(isValidPaymentSignature(secret, "order_1", "pay_1", sig)).toBe(true);
  });

  it("rejects a signature for a different payment, secret or length", () => {
    const sig = hmacHex(secret, "order_1|pay_1");
    expect(isValidPaymentSignature(secret, "order_1", "pay_2", sig)).toBe(false);
    expect(isValidPaymentSignature("other", "order_1", "pay_1", sig)).toBe(false);
    expect(isValidPaymentSignature(secret, "order_1", "pay_1", sig.slice(2))).toBe(false);
    expect(isValidPaymentSignature(secret, "order_1", "pay_1", "")).toBe(false);
  });

  it("checks webhooks against the exact raw body", () => {
    const body = '{"event":"payment.captured"}';
    const sig = hmacHex(secret, body);
    expect(isValidWebhookSignature(secret, body, sig)).toBe(true);
    expect(isValidWebhookSignature(secret, `${body} `, sig)).toBe(false);
  });
});

describe("plan expiry", () => {
  const now = new Date("2026-11-09T12:00:00Z");

  it("treats a plan as active only before it expires", () => {
    expect(activePlan("premium", "2026-11-10T00:00:00Z", now)).toBe("premium");
    expect(activePlan("premium", "2026-11-09T11:59:59Z", now)).toBeNull();
    expect(activePlan("premium", null, now)).toBeNull();
    expect(activePlan(null, "2026-12-01T00:00:00Z", now)).toBeNull();
  });

  it("rounds days left up and never goes negative", () => {
    expect(daysLeft("2026-11-10T00:00:00Z", now)).toBe(1);
    expect(daysLeft("2026-12-09T12:00:00Z", now)).toBe(30);
    expect(daysLeft("2026-11-01T00:00:00Z", now)).toBe(0);
  });
});

describe("payments migration", () => {
  const sql = readFileSync("supabase/migrations/20261109020000_payments.sql", "utf8");

  it("keeps fulfilment and plan grants away from browser roles", () => {
    expect(sql).toMatch(/revoke all on function public\.fulfill_payment\([^)]*\) from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.grant_plan\([^)]*\) from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant execute on function public\.(fulfill_payment|grant_plan)[^;]*authenticated/);
  });

  it("removes the free mock plan and client writes to inventory and avatar", () => {
    expect(sql).toContain("drop function if exists public.activate_mock_plan");
    expect(sql).toContain("grant select on public.user_avatar_inventory, public.streaks to authenticated;");
    const update = sql.match(/grant update \(([^)]*)\) on public\.profiles/)?.[1] ?? "";
    expect(update).not.toMatch(/plan|role|avatar|onboarded|suspended|trust/);
  });
});
