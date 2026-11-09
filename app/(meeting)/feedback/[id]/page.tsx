import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { getMatchView } from "@/lib/actions/matching";
import { isUuid } from "@/lib/db/map";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "How was it?" };

export default async function FeedbackPage({ params, searchParams }: PageProps<"/feedback/[id]">) {
  const { id } = await params;
  if (isUuid(id)) {
    const view = await getMatchView(id);
    if (!view || (view.status !== "ended" && view.status !== "live")) notFound();
    return <FeedbackForm meetingId={id} partner={view.partner} food={view.food} live />;
  }
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return <FeedbackForm meetingId={id} partner={partner} food={food} />;
}
