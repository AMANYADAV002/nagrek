import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { iceConfigFor } = await import("@/lib/webrtc/turn");

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);

describe("iceConfigFor", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns no servers and stays relay-only without TURN configured", () => {
    vi.stubEnv("TURN_URLS", "");
    const ice = iceConfigFor("user-1", NOW);
    expect(ice.relayOnly).toBe(true);
    expect(ice.iceServers).toHaveLength(0);
  });

  it("mints coturn shared-secret credentials that expire in 2 hours and drops STUN urls", () => {
    vi.stubEnv("TURN_URLS", "stun:stun.l.google.com:19302,turn:turn.example.com:3478,turns:turn.example.com:5349");
    vi.stubEnv("TURN_SECRET", "s3cret");
    const ice = iceConfigFor("user-1", NOW);
    expect(ice.relayOnly).toBe(true);
    expect(ice.iceServers).toHaveLength(1);
    const turn = ice.iceServers[0]!;
    const expiry = NOW / 1000 + 7200;
    expect(turn.username).toBe(`${expiry}:user-1`);
    expect(turn.credential).toBe(createHmac("sha1", "s3cret").update(`${expiry}:user-1`).digest("base64"));
    expect(turn.urls).toEqual(["turn:turn.example.com:3478", "turns:turn.example.com:5349"]);
  });

  it("stays relay-only even when the old force flag is off", () => {
    vi.stubEnv("TURN_URLS", "turn:turn.example.com:3478");
    vi.stubEnv("TURN_SECRET", "s3cret");
    vi.stubEnv("TURN_FORCE_RELAY", "");
    expect(iceConfigFor("u", NOW).relayOnly).toBe(true);
    vi.stubEnv("TURN_URLS", "stun:stun.l.google.com:19302");
    expect(iceConfigFor("u", NOW)).toEqual({ iceServers: [], relayOnly: true });
  });
});
