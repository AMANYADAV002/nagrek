import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreMeet } from "@/components/video-room/pre-meet";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "Your match" };

export default async function PreMeetPage({ params, searchParams }: PageProps<"/match/[id]/pre">) {
  const { id } = await params;
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return <PreMeet matchId={id} partner={partner} food={food} />;
}
