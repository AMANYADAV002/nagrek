import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Wordmark className="text-3xl" />
      {children}
    </main>
  );
}
