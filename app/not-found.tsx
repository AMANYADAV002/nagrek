import { GradientLink } from "@/components/glass/gradient-button";
import { GlassCard } from "@/components/glass/glass-card";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-6">
      <GlassCard className="max-w-md space-y-4 p-8 text-center">
        <p className="font-heading text-7xl font-bold text-brand">404</p>
        <h1 className="text-2xl font-medium">This table does not exist</h1>
        <p className="text-sm text-soft">The page you are looking for has been cleared away.</p>
        <GradientLink href="/">Back to the menu</GradientLink>
      </GlassCard>
    </main>
  );
}
