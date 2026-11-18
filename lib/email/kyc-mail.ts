import type { Caller } from "@/lib/server/caller";

const COPY = {
  pending: {
    subject: "Your Nagrek identity check has started",
    text: "We started your identity check. You can return to Nagrek to see when it finishes. We do not store your identity document.",
  },
  verified: {
    subject: "Your Nagrek identity check is complete",
    text: "Your identity check is complete. You can use matching now.",
  },
  rejected: {
    subject: "Your Nagrek identity check was not completed",
    text: "Your identity check was not completed. Nagrek is only for people who are 18 or older.",
  },
} as const;

/** Best-effort notice. A mail outage does not change the verification result. */
export async function sendKycMail(admin: Caller["admin"], userId: string, kind: keyof typeof COPY): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const to = data.user?.email;
  if (error || !to) return;
  const message = COPY[kind];
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // The verification row is already saved. Do not log the address.
  }
}
