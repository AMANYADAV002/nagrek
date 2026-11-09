import type { Metadata } from "next";
import { AvatarBuilder } from "@/components/avatar/avatar-builder";

export const metadata: Metadata = { title: "Avatar studio" };

export default function AvatarPage() {
  return <AvatarBuilder />;
}
