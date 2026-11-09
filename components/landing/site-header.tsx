import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { GradientLink } from "@/components/glass/gradient-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-ink/70 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/55">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-[6%] md:h-20">
        <Wordmark className="text-xl md:text-3xl" />
        <nav aria-label="Site" className="flex items-center gap-2 text-sm md:gap-8">
          <Link href="#how-it-works" className="hidden text-soft transition-colors hover:text-peach md:inline">How it works</Link>
          <Link href="#plans" className="hidden text-soft transition-colors hover:text-peach md:inline">Plans</Link>
          <Link href="#faq" className="hidden text-soft transition-colors hover:text-peach md:inline">FAQ</Link>
          <Link href="/sign-in" className="rounded-full border border-white/12 px-3.5 py-2 text-xs transition-colors hover:border-peach/60 md:px-5 md:py-2.5">
            Sign in
          </Link>
          <GradientLink href="/sign-up" size="sm">Get started</GradientLink>
        </nav>
      </div>
    </header>
  );
}
