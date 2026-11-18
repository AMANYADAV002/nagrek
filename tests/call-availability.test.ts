import { describe, expect, it } from "vitest";
import { ABANDONED_CALL_MS, callAvailability, RING_MS, type OpenCall } from "@/lib/calls/availability";

const now = Date.parse("2026-11-11T12:00:00Z");
const me = "user-a";
const them = "user-b";
const other = "user-c";

function row(partial: Partial<OpenCall> & Pick<OpenCall, "id" | "caller_id" | "callee_id" | "status">): OpenCall {
  return { created_at: new Date(now - 5_000).toISOString(), connected_at: null, ...partial };
}

describe("callAvailability", () => {
  it("starts a call when nobody is in one", () => {
    expect(callAvailability(me, them, [], now)).toEqual({ action: "start" });
  });

  it("reuses a fresh ring between the same two people", () => {
    const ringing = row({ id: "call-1", caller_id: them, callee_id: me, status: "ringing" });
    expect(callAvailability(me, them, [ringing], now)).toEqual({ action: "reuse", callId: "call-1" });
  });

  it("ignores a ring that already timed out", () => {
    const stale = row({
      id: "call-old",
      caller_id: them,
      callee_id: other,
      status: "ringing",
      created_at: new Date(now - RING_MS - 1_000).toISOString(),
    });
    expect(callAvailability(me, them, [stale], now)).toEqual({ action: "start" });
  });

  it("blocks only when the other person is live with someone else", () => {
    const busy = row({
      id: "call-2",
      caller_id: them,
      callee_id: other,
      status: "accepted",
      connected_at: new Date(now - 10_000).toISOString(),
    });
    expect(callAvailability(me, them, [busy], now)).toEqual({ action: "busy" });
  });

  it("ignores an accepted call that never connected", () => {
    const dropped = row({
      id: "call-3",
      caller_id: them,
      callee_id: other,
      status: "accepted",
      created_at: new Date(now - ABANDONED_CALL_MS - 1_000).toISOString(),
      connected_at: null,
    });
    expect(callAvailability(me, them, [dropped], now)).toEqual({ action: "start" });
  });
});
