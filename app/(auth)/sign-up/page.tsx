import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
