import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "How was it?" };

export default async function FeedbackPage({ params, searchParams }: PageProps<"/feedback/[id]">) {
  const { id } = await params;
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return <FeedbackForm meetingId={id} partner={partner} food={food} />;
}
