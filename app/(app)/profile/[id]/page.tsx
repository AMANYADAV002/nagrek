import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { getPerson } from "@/lib/actions/people";
import { isUuid } from "@/lib/db/map";
import { getMockUser, mockUsers } from "@/lib/mock/users";
import { safeReturnPath } from "@/lib/stories/comment-text";

export function generateStaticParams() {
  return mockUsers.map((u) => ({ id: u.id }));
}

export default async function UserProfilePage({ params, searchParams }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromRaw = Array.isArray(from) ? from[0] : from;
  const user = isUuid(id) ? await getPerson(id) : getMockUser(id);
  if (!user) notFound();
  const backHref = fromRaw === "match" ? "/dashboard" : safeReturnPath(fromRaw);
  return <ProfileView user={user} backHref={backHref} backLabel={fromRaw === "match" ? "Back to matches" : "Back"} />;
}
