import { RestaurantsView } from "@/components/restaurants/restaurants-view";

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string | string[]; name?: string | string[]; food?: string | string[] }>;
}) {
  const q = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value.slice(0, 80) : "");
  return <RestaurantsView withId={one(q.with)} partnerName={one(q.name)} food={one(q.food)} />;
}
