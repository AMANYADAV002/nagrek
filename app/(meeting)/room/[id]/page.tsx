import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomLoader } from "@/components/video-room/room-loader";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "Live table" };

export default async function RoomPage({ params, searchParams }: PageProps<"/room/[id]">) {
  const { id } = await params;
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return <RoomLoader meetingId={id} partner={partner} food={food} />;
}
