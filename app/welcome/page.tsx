import type { Metadata } from "next";
import { Guard } from "@/components/guard";
import { WelcomeExperience } from "@/components/welcome/welcome-experience";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <Guard need="onboarded">
      <WelcomeExperience />
    </Guard>
  );
}
