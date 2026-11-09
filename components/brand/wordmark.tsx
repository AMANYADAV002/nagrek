import Link from "next/link";
import { Aperture } from "lucide-react";
import { cn } from "@/lib/utils";

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-heading text-2xl font-bold tracking-tight", className)}
      aria-label="Nagrek home"
    >
      <Aperture className="size-6 text-peach" aria-hidden />
      nagrek<span className="-ml-1.5 text-peach">.</span>
    </Link>
  );
}
