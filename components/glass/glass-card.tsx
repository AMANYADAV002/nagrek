import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  strong,
  ...props
}: React.ComponentProps<"div"> & { strong?: boolean }) {
  return <div className={cn(strong ? "glass-strong" : "glass", "rounded-2xl", className)} {...props} />;
}
