import { AppNav } from "@/components/layout/app-nav";
import { Guard } from "@/components/guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard need="plan">
      <AppNav />
      <div className="lg:pl-64">
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-8 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>
    </Guard>
  );
}
