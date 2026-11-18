/** Run a router change after the App Router has finished starting. */
export function whenRouterReady(run: () => void) {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    try {
      run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("before initialization")) {
        requestAnimationFrame(() => {
          try {
            run();
          } catch {
            // The click can be repeated. Swallowing a second failure avoids the burnt-page crash.
          }
        });
        return;
      }
      throw error;
    }
  });
}
