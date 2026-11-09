import type { Metadata } from "next";
import { Guard } from "@/components/guard";
import { PlansView } from "@/components/plans/plans-view";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <Guard need="onboarded">
      <PlansView />
    </Guard>
  );
}
