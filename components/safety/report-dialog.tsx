"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Chip } from "@/components/glass/chip";
import { GradientButton } from "@/components/glass/gradient-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fileReport } from "@/lib/actions/meeting";
import { uid } from "@/lib/format";
import { updateSession, type ReportRecord } from "@/lib/mock/session";
import { backendEnabled } from "@/lib/supabase/env";

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Sexual or explicit content",
  "Hate or violence",
  "Underage user",
  "Fake profile or scam",
  "Spam",
  "Something else",
] as const;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Choose a reason" }),
  details: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

/**
 * Report flow used on every surface (profile, story, room, feedback).
 * Live reports go to `reports` through a rate-limited server action.
 */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetName,
  onReported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportRecord["targetType"];
  targetId: string;
  targetName: string;
  onReported?: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const parsed = reportSchema.safeParse({ reason, details: details || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid report");
      return;
    }
    if (backendEnabled()) {
      setSending(true);
      const res = await fileReport({ targetType, targetId, reason: parsed.data.reason, details: parsed.data.details });
      setSending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
    }
    updateSession((s) => ({
      reports: [
        ...s.reports,
        { id: uid("rep"), targetType, targetId, reason: parsed.data.reason, details: parsed.data.details, createdAt: new Date().toISOString() },
      ],
    }));
    toast.success("Report sent. Our team will review it — thank you for keeping Nagrek safe.");
    setReason("");
    setDetails("");
    setError(null);
    onOpenChange(false);
    onReported?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-7 sm:max-w-md">
        <div className="space-y-5">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Flag className="size-5 text-peach" aria-hidden /> Report {targetName}
            </DialogTitle>
            <DialogDescription>Reports are confidential. The person is not told who reported them.</DialogDescription>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map((r) => (
              <Chip key={r} selected={reason === r} onClick={() => setReason(r)} role="radio" aria-checked={reason === r}>
                {r}
              </Chip>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything else we should know? (optional)"
            maxLength={500}
            className="min-h-24 rounded-xl"
            aria-label="Report details"
          />
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <GradientButton variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </GradientButton>
            <GradientButton variant="danger" onClick={() => void submit()} disabled={sending}>
              {sending ? "Sending…" : "Send report"}
            </GradientButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
