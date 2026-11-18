import type { Metadata } from "next";
import { Suspense } from "react";
import { DigiLockerPanel } from "@/components/digilocker/digilocker-panel";

export const metadata: Metadata = { title: "DigiLocker" };

export default function DigiLockerPage() {
  return (
    <Suspense>
      <DigiLockerPanel />
    </Suspense>
  );
}
