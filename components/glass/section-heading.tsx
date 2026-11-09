import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-[10px] font-bold tracking-[0.2em] text-peach uppercase", className)}>
      <span className="size-1.5 rounded-full bg-peach shadow-[0_0_10px_#ff936f]" aria-hidden />
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8", className)}>
      <div className="space-y-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
        {description && <p className="max-w-xl text-sm leading-relaxed text-soft">{description}</p>}
      </div>
      {action}
    </header>
  );
}
