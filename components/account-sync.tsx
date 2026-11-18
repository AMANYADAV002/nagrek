"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchMyAccount } from "@/lib/account-client";
import { blankSession, hydrateSession, peekSession, sessionEpoch } from "@/lib/mock/session";
import { backendEnabled } from "@/lib/supabase/env";

/** When Supabase is configured, replace the empty session with the signed-in account. */
export function AccountSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !backendEnabled()) return;
    started.current = true;
    const seen = sessionEpoch();
    fetchMyAccount().then((result) => {
      // A login or logout happened while this was in flight. Keep that newer session.
      if (sessionEpoch() !== seen) return;
      if (result.account) hydrateSession(result.account);
      else if (result.error) {
        toast.error(result.error);
        if (!peekSession()?.user) hydrateSession(blankSession());
      } else hydrateSession(blankSession());
    });
  }, []);

  return null;
}
