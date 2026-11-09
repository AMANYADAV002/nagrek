import { NextResponse } from "next/server";
import { loadMyAccount } from "@/lib/actions/account";

export const dynamic = "force-dynamic";

/**
 * Signed-in account for the client session store.
 * A GET route rather than a server action: the App Router queues navigations
 * behind in-flight actions, so an action on page load stalls the first link click.
 */
export async function GET() {
  const result = await loadMyAccount();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
