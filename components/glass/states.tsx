import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-8 animate-spin rounded-full border-2 border-white/10 border-t-peach", className)}
    />
  );
}

export function FullScreenLoader({ label = "Setting the table…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-soft">
      <Spinner />
      <p className="text-xs tracking-widest uppercase">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon && <div className="text-peach">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="max-w-sm text-sm text-soft">{description}</p>}
      {action}
    </GlassCard>
  );
}
