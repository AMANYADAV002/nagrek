import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Guard } from "@/components/guard";
import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** TODO(phase-7): require `profiles.role = 'admin'` server-side (proxy + RLS), not just a signed-in user. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Guard need="auth">
      <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <Wordmark />
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-200">
            <ShieldAlert className="size-3.5" aria-hidden /> Admin · mock data
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
