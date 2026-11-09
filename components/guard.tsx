"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirectFor, type Requirement } from "@/lib/guards";
import { snapshotOf, useSession } from "@/lib/mock/session";
import { FullScreenLoader } from "@/components/glass/states";

/**
 * Client-side route guard for Phase 1 (mock session).
 * TODO(phase-2): proxy.ts enforces the same rules server-side with Supabase.
 */
export function Guard({ need, children }: { need: Requirement; children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const target = session ? redirectFor(need, snapshotOf(session)) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!session || target) return <FullScreenLoader />;
  return <>{children}</>;
}
