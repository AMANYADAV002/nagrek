import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyKycView } from "@/components/kyc/verify-kyc-view";

export const metadata: Metadata = { title: "Verify identity" };

export default function VerifyKycPage() {
  return (
    <Suspense>
      <VerifyKycView />
    </Suspense>
  );
}
