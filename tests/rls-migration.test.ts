import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261109000000_init.sql", "utf8");

describe("schema safety", () => {
  it("enables row level security on every table", () => {
    const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    const locked = new Set([...sql.matchAll(/alter table public\.(\w+) enable row level security/g)].map((m) => m[1]));
    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter((t) => !locked.has(t))).toEqual([]);
  });

  it("does not let clients read coupon codes", () => {
    const section = sql.slice(sql.indexOf("create table public.reward_codes"));
    expect(section).toContain("enable row level security");
    expect(sql).not.toContain('on public.reward_codes\n  for select');
    expect(sql).not.toContain("grant select on public.reward_codes");
  });

  it("keeps coordinates off the public profile update list", () => {
    expect(sql).toContain("grant update (");
    expect(sql).not.toMatch(/grant update \([^)]*lat/);
  });
});
