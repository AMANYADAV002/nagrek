import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Guard } from "@/components/guard";
import { Wordmark } from "@/components/brand/wordmark";
import { isAdmin } from "@/lib/actions/admin";
import { backendEnabled } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** Live: only profiles with role = 'admin' (checked again by every admin action). Demo: any signed-in user, local data. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const live = backendEnabled();
  if (live && !(await isAdmin())) notFound();
  return (
    <Guard need="auth">
      <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <Wordmark />
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-200">
            <ShieldAlert className="size-3.5" aria-hidden /> Admin{live ? "" : " · demo data"}
          </span>
          <nav className="ml-auto flex gap-2 text-sm" aria-label="Admin">
            <Link href="/admin/reports" className="rounded-full px-3 py-1.5 hover:bg-white/10">Reports</Link>
            <Link href="/admin/rewards" className="rounded-full px-3 py-1.5 hover:bg-white/10">Rewards</Link>
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-soft hover:bg-white/10">Back to app</Link>
          </nav>
        </header>
        {children}
      </div>
    </Guard>
  );
}
