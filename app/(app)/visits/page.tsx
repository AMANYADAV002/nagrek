import type { Metadata } from "next";
import { VisitsView } from "@/components/visits/visits-view";

export const metadata: Metadata = { title: "Visits" };

export default async function VisitsPage({ searchParams }: PageProps<"/visits">) {
  const { with: withId } = await searchParams;
  return <VisitsView withId={typeof withId === "string" ? withId : undefined} />;
}
