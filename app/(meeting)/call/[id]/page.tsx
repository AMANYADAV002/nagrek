import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CallRoom } from "@/components/calls/call-room";
import { getCall } from "@/lib/actions/calls";

export const metadata: Metadata = { title: "Call" };

export default async function CallPage({ params }: PageProps<"/call/[id]">) {
  const { id } = await params;
  const view = await getCall(id);
  if (!view) notFound();
  return <CallRoom view={view} />;
}
