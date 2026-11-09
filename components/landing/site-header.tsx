import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { GradientLink } from "@/components/glass/gradient-button";

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-20 max-w-[1440px] items-center justify-between border-b border-white/8 px-[6%] md:h-24">
      <Wordmark className="text-2xl md:text-3xl" />
      <nav aria-label="Site" className="flex items-center gap-2 text-sm md:gap-8">
        <Link href="#how-it-works" className="hidden text-soft hover:text-peach md:inline">How it works</Link>
        <Link href="#plans" className="hidden text-soft hover:text-peach md:inline">Plans</Link>
        <Link href="#faq" className="hidden text-soft hover:text-peach md:inline">FAQ</Link>
        <Link href="/sign-in" className="rounded-full border border-white/12 px-4 py-2.5 text-xs hover:border-peach/60 md:px-5">
          Sign in
        </Link>
        <GradientLink href="/sign-up" size="sm" className="hidden sm:inline-flex">Get started</GradientLink>
      </nav>
    </header>
  );
}
