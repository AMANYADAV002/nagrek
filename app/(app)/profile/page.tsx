import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Your profile" };

export default function MyProfilePage() {
  return <ProfileView />;
}
