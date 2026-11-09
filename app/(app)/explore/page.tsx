import type { Metadata } from "next";
import { ExploreView } from "@/components/explore/explore-view";

export const metadata: Metadata = { title: "Explore places" };

export default function ExplorePage() {
  return <ExploreView />;
}
