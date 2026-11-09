"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass, Flame, Heart, Home, ListChecks, LogOut, Sparkles, User, Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getPlan } from "@/lib/config/plans";
import { useSession } from "@/lib/mock/session";
import { signOutEverywhere } from "@/lib/db/remote";
import { backendEnabled } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/stories", label: "Stories", icon: Sparkles },
  { href: "/streak", label: "Streak", icon: Flame },
  { href: "/connections", label: "People", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

const secondary = [
  { href: "/explore", label: "Explore places", icon: Compass },
  { href: "/wishlist", label: "Wish list", icon: ListChecks },
  { href: "/avatar", label: "Avatar studio", icon: Heart },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const session = useSession();
  const plan = getPlan(session?.plan);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/8 bg-ink/60 p-6 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between">
          <Wordmark href="/dashboard" />
          <NotificationBell />
        </div>
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {[...items, ...secondary].map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "text-cream" : "text-soft hover:bg-white/5 hover:text-cream",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon className={cn("relative size-4", active && "text-peach")} aria-hidden />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        {session?.user && (
          <div className="mt-auto space-y-3">
            <div className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="size-10 shrink-0">
                <LayeredAvatar config={session.avatar} title={session.user.name} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{session.user.name}</p>
                <p className="text-xs text-peach">{plan ? `${plan.name} plan` : "No plan"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void signOutEverywhere();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-soft hover:bg-white/5 hover:text-cream"
            >
              <LogOut className="size-3.5" aria-hidden /> {backendEnabled() ? "Sign out" : "Sign out (resets demo)"}
            </button>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/8 bg-ink/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Wordmark href="/dashboard" className="text-xl" />
        <div className="flex items-center gap-1">
          <NotificationBell />
          {secondary.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "grid size-10 place-items-center rounded-full",
                isActive(pathname, href) ? "bg-white/10 text-peach" : "text-soft",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </Link>
          ))}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-full border border-white/10 bg-ink/80 px-2 py-1.5 backdrop-blur-xl lg:hidden"
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px]",
                active ? "text-cream" : "text-soft",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-mobile"
                  className="absolute inset-0 rounded-full bg-white/[0.08]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className={cn("relative size-5", active && "text-peach")} aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
