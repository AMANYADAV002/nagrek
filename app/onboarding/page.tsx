import type { Metadata } from "next";
import { Guard } from "@/components/guard";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = { title: "Set your table" };

export default function OnboardingPage() {
  return (
    <Guard need="auth">
      <OnboardingWizard />
    </Guard>
  );
}
