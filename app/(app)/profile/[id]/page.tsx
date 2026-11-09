import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { getPerson } from "@/lib/actions/people";
import { isUuid } from "@/lib/db/map";
import { getMockUser, mockUsers } from "@/lib/mock/users";

export function generateStaticParams() {
  return mockUsers.map((u) => ({ id: u.id }));
}

export default async function UserProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const user = isUuid(id) ? await getPerson(id) : getMockUser(id);
  if (!user) notFound();
  return <ProfileView user={user} />;
}
