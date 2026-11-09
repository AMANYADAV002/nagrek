"use client";

import { AccountSync } from "@/components/account-sync";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AccountSync />
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(21,22,27,0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f6f3ef",
            borderRadius: 16,
          },
        }}
      />
    </MotionConfig>
  );
}
