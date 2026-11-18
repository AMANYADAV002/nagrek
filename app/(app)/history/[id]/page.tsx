import type { Metadata } from "next";
import { DirectChat } from "@/components/history/direct-chat";

export const metadata: Metadata = { title: "Chat" };

export default async function HistoryChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectChat partnerId={id} />;
}
