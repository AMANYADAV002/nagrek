export type AnalyticsEvent =
  | "signup"
  | "onboarding_complete"
  | "payment"
  | "craving"
  | "match"
  | "meeting_complete"
  | "story_posted"
  | "reward_claimed";

/** TODO(phase-7): forward to an analytics provider. Phase 1 logs in development only. */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[analytics] ${event}`, props);
  }
}
