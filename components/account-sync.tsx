"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchMyAccount } from "@/lib/account-client";
import { blankSession, hydrateSession } from "@/lib/mock/session";
import { backendEnabled } from "@/lib/supabase/env";

/** When Supabase is configured, replace the empty session with the signed-in account. */
export function AccountSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !backendEnabled()) return;
    started.current = true;
    fetchMyAccount().then((result) => {
      if (result.error) toast.error(result.error);
      hydrateSession(result.account ?? blankSession());
    });
  }, []);

  return null;
}
