import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RoomLoader } from "@/components/video-room/room-loader";
import { getMatchView } from "@/lib/actions/matching";
import { getCaller } from "@/lib/server/caller";
import { isUuid } from "@/lib/db/map";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "Live table" };

export default async function RoomPage({ params, searchParams }: PageProps<"/room/[id]">) {
  const { id } = await params;
  if (isUuid(id)) {
    const [view, caller] = await Promise.all([getMatchView(id), getCaller()]);
    if (!view || !caller) notFound();
    if (view.status === "pending") redirect(`/match/${id}/pre`);
    if (view.status !== "live") redirect(view.status === "ended" ? `/feedback/${id}` : "/dashboard");
    return <RoomLoader meetingId={id} partner={view.partner} food={view.food} live={{ me: caller.userId, role: view.role }} />;
  }
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return <RoomLoader meetingId={id} partner={partner} food={food} />;
}
