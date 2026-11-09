import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { getMockUser, mockUsers } from "@/lib/mock/users";

export function generateStaticParams() {
  return mockUsers.map((u) => ({ id: u.id }));
}

export default async function UserProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  // TODO(phase-2): load from `profiles` with RLS + block filtering server-side.
  const user = getMockUser(id);
  if (!user) notFound();
  return <ProfileView user={user} />;
}
