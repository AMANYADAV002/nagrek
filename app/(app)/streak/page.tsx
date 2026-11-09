import type { Metadata } from "next";
import { StreakView } from "@/components/streak/streak-view";

export const metadata: Metadata = { title: "Streak & rewards" };

export default function StreakPage() {
  return <StreakView />;
}
