import type { Metadata } from "next";
import { StoriesFeed } from "@/components/stories/stories-feed";

export const metadata: Metadata = { title: "Stories" };

export default function StoriesPage() {
  return <StoriesFeed />;
}
