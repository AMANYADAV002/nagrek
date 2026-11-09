import { getMockUser } from "@/lib/mock/users";

/** Resolves the `?with=&food=` search params used across the meeting routes. */
export async function resolveMeeting(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const sp = await searchParams;
  const withId = typeof sp.with === "string" ? sp.with : "";
  const food = typeof sp.food === "string" ? sp.food : "Coffee";
  return { partner: getMockUser(withId) ?? null, food };
}
