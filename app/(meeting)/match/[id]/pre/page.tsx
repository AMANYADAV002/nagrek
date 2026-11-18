import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionBoundary } from "@/components/section-boundary";
import { PreMeet } from "@/components/video-room/pre-meet";
import { getMatchView } from "@/lib/actions/matching";
import { isUuid } from "@/lib/db/map";
import { resolveMeeting } from "@/lib/meeting";

export const metadata: Metadata = { title: "Your match" };

export default async function PreMeetPage({ params, searchParams }: PageProps<"/match/[id]/pre">) {
  const { id } = await params;
  if (isUuid(id)) {
    const view = await getMatchView(id);
    if (!view) notFound();
    return (
      <SectionBoundary>
      <PreMeet
        matchId={id}
        partner={view.partner}
        food={view.food}
        live={{ status: view.status, mine: view.mine, theirs: view.theirs, decideBy: view.decideBy }}
      />
      </SectionBoundary>
    );
  }
  const { partner, food } = await resolveMeeting(searchParams);
  if (!partner) notFound();
  return (
    <SectionBoundary>
      <PreMeet matchId={id} partner={partner} food={food} />
    </SectionBoundary>
  );
}
