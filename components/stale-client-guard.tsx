"use client";

import { useEffect } from "react";

const RELOAD_KEY = "nagrek.reloaded-stale-action";

function textOf(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  return typeof reason === "string" ? reason : "";
}

/**
 * A tab left open across a deploy still calls the old server action. That rejection
 * was taking down the page. Reload once, and ignore the router-not-ready crash.
 */
export function StaleClientGuard() {
  useEffect(() => {
    const clearFlag = window.setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 15_000);
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = textOf(event.reason);
      if (!message.includes("Server Action") || !message.includes("was not found")) return;
      event.preventDefault();
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      location.reload();
    };
    const onError = (event: ErrorEvent) => {
      if (!String(event.message).includes("Router action dispatched before initialization")) return;
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.clearTimeout(clearFlag);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
